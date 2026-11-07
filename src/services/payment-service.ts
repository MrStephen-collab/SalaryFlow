import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { preparePaymentProvider } from "@/lib/platform-config";
import { recordAudit } from "./audit-service";
import { getPaymentProvider } from "./payment-provider";
import { LedgerService } from "./ledger-service";

/**
 * Gateway collections.
 *
 * Money can enter the platform in two ways:
 *   - ORGANIZATION_FUNDING: an organization tops up its thrift pool.
 *   - SAVINGS_DEPOSIT: an external member tops up their savings wallet.
 *
 * Intents are recorded in payment_transactions before the payer leaves for the
 * gateway, then settled idempotently from the callback and the webhook. The
 * settlement path uses the service role because webhooks have no session.
 */

export const FUNDING_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "ACCOUNTANT",
  "PAYROLL_OFFICER",
]);

export const MIN_FUNDING_AMOUNT = 1000;
export const MAX_FUNDING_AMOUNT = 50_000_000;

export const SUBSCRIPTION_PAYMENT_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
]);

export interface StartFundingResult {
  ok: boolean;
  authorizationUrl?: string;
  reference?: string;
  error?: string;
}

export interface SettlementResult {
  ok: boolean;
  paid: boolean;
  status: string;
  purpose?: string;
  amount?: number;
  message?: string;
}

function reference(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

function validateAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < MIN_FUNDING_AMOUNT) {
    return `Enter at least ₦${MIN_FUNDING_AMOUNT.toLocaleString()}`;
  }
  if (amount > MAX_FUNDING_AMOUNT) {
    return `The maximum single funding amount is ₦${MAX_FUNDING_AMOUNT.toLocaleString()}`;
  }
  return null;
}

export class PaymentService {
  /** Start a thrift-pool or member-loan-pool top-up for the organization. */
  static async startOrganizationFunding(input: {
    amount: number;
    callbackUrl: string;
    fundAccountId?: string;
  }): Promise<StartFundingResult> {
    const amountError = validateAmount(input.amount);
    if (amountError) return { ok: false, error: amountError };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return { ok: false, error: "No organization is linked to this account" };
    }
    if (!FUNDING_ROLES.has(profile.role)) {
      return { ok: false, error: "You do not have permission to fund this organization" };
    }

    if (input.fundAccountId) {
      const { data: fundAccount } = await supabase
        .from("fund_accounts")
        .select("id")
        .eq("id", input.fundAccountId)
        .eq("organization_id", profile.organization_id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!fundAccount) {
        return { ok: false, error: "The selected fund account was not found" };
      }
    }

    await preparePaymentProvider(profile.organization_id);
    const provider = getPaymentProvider();
    if (!provider.supportsCollections()) {
      return {
        ok: false,
        error:
          "Online funding is not switched on yet. Add the payment gateway keys (PAYSTACK_SECRET_KEY) to enable it.",
      };
    }

    const internalReference = reference("SF-FUND");
    const email = user.email ?? "";

    const { data: intent, error } = await supabase
      .from("payment_transactions")
      .insert({
        organization_id: profile.organization_id,
        purpose: "ORGANIZATION_FUNDING",
        fund_account_id: input.fundAccountId ?? null,
        payer_user_id: user.id,
        payer_email: email,
        provider: provider.name,
        internal_reference: internalReference,
        amount: input.amount,
        currency: "NGN",
        status: "PENDING",
        metadata: {
          source: "dashboard/funds",
          role: profile.role,
          fundAccountId: input.fundAccountId ?? null,
        },
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    const init = await provider.initializeCollection({
      email,
      amount: input.amount,
      currency: "NGN",
      reference: internalReference,
      callbackUrl: input.callbackUrl,
      metadata: {
        purpose: "ORGANIZATION_FUNDING",
        organizationId: profile.organization_id,
        paymentTransactionId: intent.id,
      },
    });

    if (!init.ok || !init.authorizationUrl) {
      await createAdminClient()
        .from("payment_transactions")
        .update({ status: "FAILED", metadata: { failure: init.error ?? "Gateway error" } })
        .eq("id", intent.id);
      return { ok: false, error: init.error ?? "The payment gateway did not return a checkout link" };
    }

    await createAdminClient()
      .from("payment_transactions")
      .update({
        authorization_url: init.authorizationUrl,
        access_code: init.accessCode ?? null,
        provider_reference: init.providerReference ?? null,
      })
      .eq("id", intent.id);

    await recordAudit({
      organizationId: profile.organization_id,
      userId: user.id,
      action: "payment.funding_started",
      entityType: "payment_transaction",
      entityId: intent.id,
      after: { amount: input.amount, provider: provider.name, reference: internalReference },
    });

    return { ok: true, authorizationUrl: init.authorizationUrl, reference: internalReference };
  }

  /** Start a savings top-up for the signed-in external member. */
  static async startSavingsDeposit(input: {
    amount: number;
    callbackUrl: string;
    loanRepaymentAmount?: number;
  }): Promise<StartFundingResult> {
    const amountError = validateAmount(input.amount);
    if (amountError) return { ok: false, error: amountError };

    const loanRepaymentAmount = Math.min(
      input.amount,
      Math.max(0, Number(input.loanRepaymentAmount) || 0)
    );

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const { data: member } = await supabase
      .from("members")
      .select("id, organization_id, status, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) return { ok: false, error: "No member profile is linked to this account" };
    if (member.status !== "ACTIVE") {
      return { ok: false, error: "Your membership is not active. Contact your organization." };
    }

    await preparePaymentProvider(member.organization_id);
    const provider = getPaymentProvider();
    if (!provider.supportsCollections()) {
      return {
        ok: false,
        error: "Online deposits are not switched on yet. Please contact your organization.",
      };
    }

    const internalReference = reference("SF-SAV");
    const email = user.email ?? "";

    const { data: intent, error } = await supabase
      .from("payment_transactions")
      .insert({
        organization_id: member.organization_id,
        purpose: "SAVINGS_DEPOSIT",
        member_id: member.id,
        payer_user_id: user.id,
        payer_email: email,
        provider: provider.name,
        internal_reference: internalReference,
        amount: input.amount,
        currency: "NGN",
        status: "PENDING",
        metadata: {
          source: "member/savings",
          loanRepaymentAmount,
        },
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    const init = await provider.initializeCollection({
      email,
      amount: input.amount,
      currency: "NGN",
      reference: internalReference,
      callbackUrl: input.callbackUrl,
      metadata: {
        purpose: "SAVINGS_DEPOSIT",
        organizationId: member.organization_id,
        memberId: member.id,
        paymentTransactionId: intent.id,
      },
    });

    if (!init.ok || !init.authorizationUrl) {
      await createAdminClient()
        .from("payment_transactions")
        .update({ status: "FAILED", metadata: { failure: init.error ?? "Gateway error" } })
        .eq("id", intent.id);
      return { ok: false, error: init.error ?? "The payment gateway did not return a checkout link" };
    }

    await createAdminClient()
      .from("payment_transactions")
      .update({
        authorization_url: init.authorizationUrl,
        access_code: init.accessCode ?? null,
        provider_reference: init.providerReference ?? null,
      })
      .eq("id", intent.id);

    return { ok: true, authorizationUrl: init.authorizationUrl, reference: internalReference };
  }

  /**
   * Start a subscription payment from an organization to the platform owner.
   * This deliberately uses the platform payment credentials, not the
   * organization's own gateway keys.
   */
  static async startSubscriptionPayment(input: {
    planId: string;
    billingCycle: "monthly" | "annually";
    callbackUrl: string;
  }): Promise<StartFundingResult> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return { ok: false, error: "No organization is linked to this account" };
    }
    if (!SUBSCRIPTION_PAYMENT_ROLES.has(profile.role)) {
      return {
        ok: false,
        error: "Only the chairman or an admin can pay for the subscription",
      };
    }

    const admin = createAdminClient();
    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id, name, price_monthly, price_annually, active")
      .eq("id", input.planId)
      .maybeSingle();

    if (!plan || !plan.active) {
      return { ok: false, error: "This subscription plan is not available" };
    }

    const amount =
      input.billingCycle === "annually"
        ? Number(plan.price_annually) || 0
        : Number(plan.price_monthly) || 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: "This plan has no price set. Contact the platform owner.",
      };
    }

    // Platform keys receive subscription revenue.
    await preparePaymentProvider();
    const provider = getPaymentProvider();
    if (!provider.supportsCollections()) {
      return {
        ok: false,
        error:
          "Subscription payments are not set up yet. Contact the platform owner.",
      };
    }

    const internalReference = reference("SF-SUB");
    const email = user.email ?? "";

    const { data: intent, error } = await admin
      .from("payment_transactions")
      .insert({
        organization_id: profile.organization_id,
        purpose: "SUBSCRIPTION",
        payer_user_id: user.id,
        payer_email: email,
        provider: provider.name,
        internal_reference: internalReference,
        amount,
        currency: "NGN",
        status: "PENDING",
        metadata: {
          source: "dashboard/settings/subscription",
          planId: plan.id,
          planName: plan.name,
          billingCycle: input.billingCycle,
        },
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    const init = await provider.initializeCollection({
      email,
      amount,
      currency: "NGN",
      reference: internalReference,
      callbackUrl: input.callbackUrl,
      metadata: {
        purpose: "SUBSCRIPTION",
        organizationId: profile.organization_id,
        planId: plan.id,
        billingCycle: input.billingCycle,
        paymentTransactionId: intent.id,
      },
    });

    if (!init.ok || !init.authorizationUrl) {
      await admin
        .from("payment_transactions")
        .update({
          status: "FAILED",
          metadata: { failure: init.error ?? "Gateway error" },
        })
        .eq("id", intent.id);
      return {
        ok: false,
        error: init.error ?? "The payment gateway did not return a checkout link",
      };
    }

    await admin
      .from("payment_transactions")
      .update({
        authorization_url: init.authorizationUrl,
        access_code: init.accessCode ?? null,
        provider_reference: init.providerReference ?? null,
      })
      .eq("id", intent.id);

    await recordAudit({
      organizationId: profile.organization_id,
      userId: user.id,
      action: "subscription.payment_started",
      entityType: "payment_transaction",
      entityId: intent.id,
      after: {
        planId: plan.id,
        billingCycle: input.billingCycle,
        amount,
        provider: provider.name,
      },
    });

    return {
      ok: true,
      authorizationUrl: init.authorizationUrl,
      reference: internalReference,
    };
  }

  /**
   * Recent gateway attempts for the caller's organization (funding history).
   */
  static async listOrganizationPayments(limit = 20) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) return [];

    const { data } = await supabase
      .from("payment_transactions")
      .select(
        "id, purpose, internal_reference, amount, fee, currency, status, channel, provider, paid_at, created_at"
      )
      .eq("organization_id", profile.organization_id)
      .eq("purpose", "ORGANIZATION_FUNDING")
      .order("created_at", { ascending: false })
      .limit(limit);

    return data ?? [];
  }

  /**
   * Verify a gateway payment and apply its effect exactly once.
   * Safe to call from the browser callback and from the webhook.
   */
  static async settle(internalReference: string): Promise<SettlementResult> {
    const admin = createAdminClient();

    const { data: intent } = await admin
      .from("payment_transactions")
      .select("*")
      .eq("internal_reference", internalReference)
      .maybeSingle();

    if (!intent) {
      return { ok: false, paid: false, status: "NOT_FOUND", message: "Payment not found" };
    }

    const alreadyApplied =
      intent.status === "SUCCESS" && Boolean(intent.metadata?.applied_at);
    if (alreadyApplied) {
      return {
        ok: true,
        paid: true,
        status: "SUCCESS",
        purpose: intent.purpose,
        amount: Number(intent.amount),
        message: "Payment already confirmed",
      };
    }

    if (intent.status === "REVERSED") {
      return { ok: false, paid: false, status: "REVERSED", message: "Payment was reversed" };
    }

    await preparePaymentProvider(
      intent.purpose === "SUBSCRIPTION" ? null : (intent.organization_id as string)
    );
    const provider = getPaymentProvider();
    const verification = await provider.verifyCollection(internalReference);

    if (!verification.ok) {
      return {
        ok: false,
        paid: false,
        status: intent.status,
        message: verification.error ?? "Could not verify the payment",
      };
    }

    const paidAmount = verification.amount ?? Number(intent.amount);

    if (!verification.paid) {
      // A failed attempt is terminal only if the gateway says so; otherwise
      // leave it PENDING so an abandoned checkout can be retried.
      await admin
        .from("payment_transactions")
        .update({
          status: "PENDING",
          channel: verification.channel ?? null,
          provider_reference: verification.providerReference ?? intent.provider_reference,
        })
        .eq("id", intent.id)
        .eq("status", "PENDING");

      return {
        ok: false,
        paid: false,
        status: "PENDING",
        message: "This payment has not been completed yet",
      };
    }

    // Claim the settlement before applying the effect so a webhook and the
    // browser callback can never credit the wallet twice.
    const { data: claimed } = await admin
      .from("payment_transactions")
      .update({
        status: "SUCCESS",
        amount: paidAmount,
        fee: verification.fee ?? 0,
        channel: verification.channel ?? intent.channel,
        provider_reference: verification.providerReference ?? intent.provider_reference,
        paid_at: verification.paidAt ?? new Date().toISOString(),
      })
      .eq("id", intent.id)
      .neq("status", "SUCCESS")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      const { data: latest } = await admin
        .from("payment_transactions")
        .select("status, metadata")
        .eq("id", intent.id)
        .maybeSingle();
      if (latest?.status === "SUCCESS" && latest.metadata?.applied_at) {
        return {
          ok: true,
          paid: true,
          status: "SUCCESS",
          purpose: intent.purpose,
          amount: paidAmount,
          message: "Payment already confirmed",
        };
      }
      // Another request claimed it and is still applying the effect.
      return {
        ok: true,
        paid: true,
        status: "SUCCESS",
        purpose: intent.purpose,
        amount: paidAmount,
        message: "Payment confirmed, account is being updated",
      };
    }

    const applied =
      intent.purpose === "ORGANIZATION_FUNDING"
        ? await this.applyOrganizationFunding(admin, intent, paidAmount)
        : intent.purpose === "SUBSCRIPTION"
          ? await this.applySubscriptionPayment(admin, intent, paidAmount)
          : await this.applySavingsDeposit(admin, intent, paidAmount);

    if (applied.error) {
      await admin
        .from("payment_transactions")
        .update({
          status: "PENDING",
          metadata: { ...(intent.metadata ?? {}), apply_error: applied.error },
        })
        .eq("id", intent.id);
      return {
        ok: false,
        paid: true,
        status: "PENDING",
        message: `Payment received but could not be applied: ${applied.error}`,
      };
    }

    await admin
      .from("payment_transactions")
      .update({
        metadata: {
          ...(intent.metadata ?? {}),
          applied_at: new Date().toISOString(),
          applied_reference: applied.reference ?? null,
        },
      })
      .eq("id", intent.id);

    await recordAudit({
      organizationId: intent.organization_id,
      userId: intent.payer_user_id,
      action: "payment.settled",
      entityType: "payment_transaction",
      entityId: intent.id,
      after: {
        purpose: intent.purpose,
        amount: paidAmount,
        provider: intent.provider,
        providerReference: verification.providerReference ?? intent.provider_reference,
        channel: verification.channel ?? null,
      },
    });

    return {
      ok: true,
      paid: true,
      status: "SUCCESS",
      purpose: intent.purpose,
      amount: paidAmount,
      message: applied.message ?? "Payment confirmed",
    };
  }

  private static async applyOrganizationFunding(
    admin: ReturnType<typeof createAdminClient>,
    intent: Record<string, unknown> & {
      organization_id: string;
      internal_reference: string;
      provider: string;
      payer_user_id?: string | null;
    },
    amount: number
  ): Promise<{ error?: string; reference?: string; message?: string }> {
    const movementReference = `PAY-${intent.internal_reference}`;

    const { data: existing } = await admin
      .from("fund_transactions")
      .select("id")
      .eq("organization_id", intent.organization_id)
      .eq("reference", movementReference)
      .maybeSingle();

    if (existing) return { reference: movementReference, message: "Funds already added" };

    let fundAccount: { id: string; name: string } | null = null;

    if (intent.fund_account_id) {
      const { data: selected } = await admin
        .from("fund_accounts")
        .select("id, name")
        .eq("id", intent.fund_account_id)
        .eq("organization_id", intent.organization_id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!selected) {
        return { error: "The funded account is no longer available" };
      }
      fundAccount = selected;
    } else {
      const { data: firstAccount } = await admin
        .from("fund_accounts")
        .select("id, name")
        .eq("organization_id", intent.organization_id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      fundAccount = firstAccount;
    }

    if (!fundAccount) {
      const { data: created, error } = await admin
        .from("fund_accounts")
        .insert({
          organization_id: intent.organization_id,
          name: "Thrift Pool",
          currency: "NGN",
          opening_balance: 0,
          status: "ACTIVE",
        })
        .select("id, name")
        .single();
      if (error) return { error: error.message };
      fundAccount = created;
    }

    const { error } = await admin.from("fund_transactions").insert({
      organization_id: intent.organization_id,
      fund_account_id: fundAccount.id,
      transaction_type: "FUNDING",
      reference: movementReference,
      amount,
      direction: "IN",
      description: `Online funding via ${intent.provider} (${intent.internal_reference})`,
      created_by: intent.payer_user_id ?? null,
    });

    if (error) return { error: error.message };

    return { reference: movementReference, message: "Thrift pool topped up" };
  }

  private static async applySavingsDeposit(
    admin: ReturnType<typeof createAdminClient>,
    intent: {
      organization_id: string;
      internal_reference: string;
      member_id?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    amount: number
  ): Promise<{ error?: string; reference?: string; message?: string }> {
    if (!intent.member_id) return { error: "This deposit is not linked to a member" };

    const ledger = LedgerService.createForOrganization(intent.organization_id);

    // Optional split: part of the payment services the member's active loan,
    // the rest is credited to savings.
    const requestedRepayment = Math.min(
      amount,
      Math.max(0, Number(intent.metadata?.loanRepaymentAmount ?? 0) || 0)
    );
    const savingsPortion =
      Math.round((amount - requestedRepayment) * 100) / 100;

    if (requestedRepayment > 0) {
      const { data: loan } = await admin
        .from("loan_applications")
        .select("id")
        .eq("member_id", intent.member_id)
        .eq("organization_id", intent.organization_id)
        .in("status", ["ACTIVE", "DISBURSED"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loan?.id) {
        const { MemberService } = await import("./member-service");
        const result = await MemberService.applyMemberRepayment(
          intent.organization_id,
          loan.id,
          requestedRepayment
        );
        if (!result.ok) {
          return { error: result.error ?? "Could not apply the loan repayment" };
        }
      }
    }

    if (savingsPortion <= 0) {
      return {
        reference: `SPLIT-${intent.internal_reference}`,
        message: "Deposit applied to the loan",
      };
    }

    const wallet = await ledger.ensureMemberFinancialAccount(intent.member_id);
    if (!wallet?.id) return { error: "No savings account for this member" };

    const depositReference = `SAV-${intent.internal_reference}`;

    const { data: existing } = await admin
      .from("savings_transactions")
      .select("id")
      .eq("reference", depositReference)
      .maybeSingle();
    if (existing) return { reference: depositReference, message: "Savings already credited" };

    const posted = await ledger.postSavingsDeposit(
      intent.member_id,
      depositReference,
      savingsPortion,
      "Savings deposit via payment gateway"
    );
    if (posted.error) return { error: posted.error };

    const { error } = await admin.from("savings_transactions").insert({
      organization_id: intent.organization_id,
      member_id: intent.member_id,
      financial_account_id: wallet.id,
      transaction_type: "DEPOSIT",
      amount: savingsPortion,
      direction: "IN",
      reference: depositReference,
      description: "Savings deposit via payment gateway",
    });
    if (error) return { error: error.message };

    return { reference: depositReference, message: "Savings credited" };
  }

  private static async applySubscriptionPayment(
    admin: ReturnType<typeof createAdminClient>,
    intent: {
      id: string;
      organization_id: string;
      internal_reference: string;
      metadata?: Record<string, unknown> | null;
    },
    amount: number
  ): Promise<{ error?: string; reference?: string; message?: string }> {
    const planId = String(intent.metadata?.planId ?? "");
    const billingCycle =
      intent.metadata?.billingCycle === "annually" ? "annually" : "monthly";

    if (!planId) {
      return { error: "This payment is not linked to a subscription plan" };
    }

    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id, name, price_monthly, price_annually")
      .eq("id", planId)
      .maybeSingle();

    if (!plan) {
      return { error: "The subscription plan no longer exists" };
    }

    const expected =
      billingCycle === "annually"
        ? Number(plan.price_annually) || 0
        : Number(plan.price_monthly) || 0;
    if (Math.abs(expected - amount) > 1) {
      return {
        error: `Paid amount ${amount} does not match the plan price ${expected}`,
      };
    }

    const start = new Date();
    const end = new Date(start);
    if (billingCycle === "annually") {
      end.setUTCFullYear(end.getUTCFullYear() + 1);
    } else {
      end.setUTCMonth(end.getUTCMonth() + 1);
    }

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("organization_id", intent.organization_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const values = {
      plan_id: planId,
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      trial_ends_at: null,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await admin
        .from("subscriptions")
        .update(values)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await admin.from("subscriptions").insert({
        organization_id: intent.organization_id,
        ...values,
      });
      if (error) return { error: error.message };
    }

    return {
      reference: `SUB-${intent.internal_reference}`,
      message: `${plan.name} subscription active until ${end.toLocaleDateString(
        "en-GB"
      )}`,
    };
  }
}
