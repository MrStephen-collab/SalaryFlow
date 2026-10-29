import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * External members (non-employees).
 *
 * Members save through the payment gateway, watch their savings grow, and
 * become eligible for a loan once they have been active for the configured
 * number of months. The loan is capped at a multiple of their own savings
 * (deposits minus withdrawals), never at loan proceeds, so a member cannot
 * borrow against money they borrowed.
 */

export const MEMBER_STAFF_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "LOAN_OFFICER",
  "ACCOUNTANT",
  "AUDITOR",
]);

export const MEMBER_APPROVER_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "LOAN_OFFICER",
]);

const MEMBER_LOAN_PRODUCT = "Member Savings Loan";

const round2 = (value: number) => Math.round(value * 100) / 100;

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);

export interface SavingsSummary {
  member: {
    id: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    joinedAt: string;
    organizationId: string;
  };
  /** The member's own money (deposits minus withdrawals). */
  savingsBalance: number;
  /** Wallet balance including any loan proceeds paid into it. */
  walletBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  monthsActive: number;
  monthsRequired: number;
  monthsRemaining: number;
  loanMultiplier: number;
  maxLoan: number;
  loanEligible: boolean;
  activeLoan: {
    id: string;
    amount: number;
    totalRepayment: number;
    status: string;
    disbursedAt: string | null;
  } | null;
  transactions: Array<{
    id: string;
    type: string;
    direction: string;
    amount: number;
    reference: string;
    description: string | null;
    createdAt: string;
  }>;
}

function monthsBetween(from: string | Date, to: Date) {
  const start = new Date(from);
  let months = (to.getFullYear() - start.getFullYear()) * 12;
  months += to.getMonth() - start.getMonth();
  if (to.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    suffix += alphabet[randomInt(0, alphabet.length)];
  }
  return `Sf${suffix}`;
}

export class MemberService {
  /** Staff-side session context; throws no error when the org is missing. */
  static async createForStaff() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let organizationId: string | null = null;
    let role: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      organizationId = profile?.organization_id ?? null;
      role = profile?.role ?? null;
    }

    return new MemberService(supabase, user?.id ?? null, organizationId, role);
  }

  private constructor(
    private supabase: Awaited<ReturnType<typeof createClient>>,
    private userId: string | null,
    private organizationId: string | null,
    private role: string | null
  ) {}

  private staffGuard() {
    if (!this.organizationId || !this.userId) return "Unauthorized";
    if (!this.role || !MEMBER_STAFF_ROLES.has(this.role)) {
      return "You do not have permission to manage members";
    }
    return null;
  }

  async listMembers(search?: string) {
    if (!this.organizationId) return [];

    let query = this.supabase
      .from("members")
      .select(
        "id, member_number, first_name, last_name, email, phone, status, kyc_status, joined_at"
      )
      .eq("organization_id", this.organizationId)
      .order("created_at", { ascending: false });

    const term = search?.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, " ");
      query = query.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,member_number.ilike.%${escaped}%`
      );
    }

    const { data } = await query;
    return data ?? [];
  }

  async getSettings() {
    if (!this.organizationId) return null;
    const { data } = await this.supabase
      .from("organization_settings")
      .select(
        "savings_min_membership_months, member_loan_multiplier, member_savings_withdrawals_enabled, default_interest_rate, default_interest_method"
      )
      .eq("organization_id", this.organizationId)
      .maybeSingle();
    return data ?? null;
  }

  async addMember(values: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
  }): Promise<{ ok: boolean; error?: string; memberId?: string; tempPassword?: string }> {
    const forbidden = this.staffGuard();
    if (forbidden) return { ok: false, error: forbidden };
    if (!this.organizationId) return { ok: false, error: "No organization found" };

    const firstName = values.firstName?.trim();
    const lastName = values.lastName?.trim();
    const email = values.email?.trim().toLowerCase();

    if (!firstName || !lastName) return { ok: false, error: "First and last name are required" };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address" };
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("members")
      .select("id")
      .eq("organization_id", this.organizationId)
      .ilike("email", email)
      .maybeSingle();

    if (existing) return { ok: false, error: "A member with this email already exists" };

    const password = tempPassword();

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${firstName} ${lastName}` },
    });

    if (authError || !authUser.user) {
      return {
        ok: false,
        error: authError?.message.includes("already")
          ? "An account with this email already exists"
          : authError?.message ?? "Could not create the member account",
      };
    }

    const userId = authUser.user.id;

    const cleanup = async () => {
      await admin.from("members").delete().eq("user_id", userId);
      await admin.from("user_profiles").delete().eq("user_id", userId);
      await admin.from("users").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    };

    const { error: userError } = await admin.from("users").insert({
      id: userId,
      email,
      full_name: `${firstName} ${lastName}`,
      phone: values.phone?.trim() || null,
    });
    if (userError) {
      await cleanup();
      return { ok: false, error: userError.message };
    }

    const { error: profileError } = await admin.from("user_profiles").insert({
      user_id: userId,
      organization_id: this.organizationId,
      role: "MEMBER",
    });
    if (profileError) {
      await cleanup();
      return { ok: false, error: profileError.message };
    }

    const { count } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", this.organizationId);

    const memberNumber = `MBR-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: member, error: memberError } = await admin
      .from("members")
      .insert({
        organization_id: this.organizationId,
        user_id: userId,
        member_number: memberNumber,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        date_of_birth: values.dateOfBirth || null,
        status: "ACTIVE",
        kyc_status: "PENDING",
      })
      .select("id")
      .single();

    if (memberError || !member) {
      await cleanup();
      return { ok: false, error: memberError?.message ?? "Could not create the member" };
    }

    const ledger = LedgerService.createForOrganization(this.organizationId, this.userId);
    await ledger.ensureMemberFinancialAccount(member.id);

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.created",
      entityType: "member",
      entityId: member.id,
      after: { firstName, lastName, email, memberNumber },
    });

    return { ok: true, memberId: member.id, tempPassword: password };
  }

  /** Savings view for a signed-in member. */
  async getMySummary(): Promise<SavingsSummary | null> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return null;

    return this.buildSummary(member);
  }

  async getSummaryForMember(memberId: string): Promise<SavingsSummary | null> {
    if (!this.organizationId) return null;
    const { data: member } = await this.supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();
    if (!member) return null;
    return this.buildSummary(member);
  }

  private async buildSummary(member: {
    id: string;
    organization_id: string;
    member_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: string;
    joined_at: string;
  }): Promise<SavingsSummary> {
    const admin = createAdminClient();

    const { data: settings } = await admin
      .from("organization_settings")
      .select("savings_min_membership_months, member_loan_multiplier")
      .eq("organization_id", member.organization_id)
      .maybeSingle();

    const monthsRequired = Number(settings?.savings_min_membership_months ?? 6);
    const multiplier = Number(settings?.member_loan_multiplier ?? 2);

    const { data: transactions } = await admin
      .from("savings_transactions")
      .select("id, transaction_type, amount, direction, reference, description, created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50);

    let totalDeposited = 0;
    let totalWithdrawn = 0;
    for (const tx of transactions ?? []) {
      const amount = Number(tx.amount) || 0;
      if (tx.transaction_type === "DEPOSIT") totalDeposited += amount;
      if (tx.transaction_type === "WITHDRAWAL") totalWithdrawn += amount;
    }

    const { data: account } = await admin
      .from("financial_accounts")
      .select("id")
      .eq("member_id", member.id)
      .eq("account_type", "SAVINGS")
      .maybeSingle();

    let walletBalance = 0;
    if (account?.id) {
      const { data: entries } = await admin
        .from("ledger_entries")
        .select("debit, credit")
        .eq("financial_account_id", account.id);
      walletBalance = (entries ?? []).reduce(
        (sum, entry) => sum + (Number(entry.credit) || 0) - (Number(entry.debit) || 0),
        0
      );
    }

    const savingsBalance = round2(totalDeposited - totalWithdrawn);
    const monthsActive = monthsBetween(member.joined_at, new Date());
    const monthsRemaining = Math.max(0, monthsRequired - monthsActive);

    const { data: activeLoan } = await admin
      .from("loan_applications")
      .select("id, amount, total_repayment, status, disbursed_at")
      .eq("member_id", member.id)
      .in("status", ["PENDING", "APPROVED", "ACTIVE"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      member: {
        id: member.id,
        memberNumber: member.member_number,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        joinedAt: member.joined_at,
        organizationId: member.organization_id,
      },
      savingsBalance,
      walletBalance: round2(walletBalance),
      totalDeposited: round2(totalDeposited),
      totalWithdrawn: round2(totalWithdrawn),
      monthsActive,
      monthsRequired,
      monthsRemaining,
      loanMultiplier: multiplier,
      maxLoan: round2(savingsBalance * multiplier),
      loanEligible:
        member.status === "ACTIVE" && monthsRemaining === 0 && savingsBalance > 0,
      activeLoan: activeLoan
        ? {
            id: activeLoan.id,
            amount: Number(activeLoan.amount),
            totalRepayment: Number(activeLoan.total_repayment),
            status: activeLoan.status,
            disbursedAt: activeLoan.disbursed_at,
          }
        : null,
      transactions: (transactions ?? []).map((tx) => ({
        id: tx.id,
        type: tx.transaction_type,
        direction: tx.direction,
        amount: Number(tx.amount),
        reference: tx.reference,
        description: tx.description,
        createdAt: tx.created_at,
      })),
    };
  }

  /** Member applies for a savings-backed loan. */
  async applyForLoan(
    amount: number,
    purpose: string
  ): Promise<{ ok: boolean; error?: string; success?: string; applicationId?: string }> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const adminClient = createAdminClient();
    const { data: member } = await adminClient
      .from("members")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { ok: false, error: "No member profile is linked to this account" };

    const summary = await this.buildSummary(member);

    if (member.status !== "ACTIVE") {
      return { ok: false, error: "Your membership is not active" };
    }
    if (summary.monthsRemaining > 0) {
      return {
        ok: false,
        error: `You can apply for a loan after ${summary.monthsRemaining} more month(s) of active membership`,
      };
    }
    if (summary.savingsBalance <= 0) {
      return { ok: false, error: "Save with us first - your loan limit is based on your savings" };
    }
    if (summary.activeLoan) {
      return { ok: false, error: "You already have a loan in progress" };
    }

    const requested = round2(Number(amount));
    if (!Number.isFinite(requested) || requested < 1000) {
      return { ok: false, error: "Enter at least ₦1,000" };
    }
    if (requested > summary.maxLoan) {
      return {
        ok: false,
        error: `Your maximum loan is ${naira(summary.maxLoan)} (${summary.loanMultiplier}× your savings)`,
      };
    }

    const admin = createAdminClient();

    const { data: settings } = await admin
      .from("organization_settings")
      .select("default_interest_rate, default_interest_method")
      .eq("organization_id", member.organization_id)
      .maybeSingle();

    const interestRate = Number(settings?.default_interest_rate ?? 5);
    const interestMethod = settings?.default_interest_method ?? "FLAT";
    const durationMonths = 6;

    const totalInterest = round2((requested * interestRate) / 100);
    const totalRepayment = round2(requested + totalInterest);
    const monthlyDeduction = round2(totalRepayment / durationMonths);

    let { data: product } = await admin
      .from("loan_products")
      .select("id")
      .eq("organization_id", member.organization_id)
      .eq("name", MEMBER_LOAN_PRODUCT)
      .maybeSingle();

    if (!product) {
      const { data: created, error } = await admin
        .from("loan_products")
        .insert({
          organization_id: member.organization_id,
          name: MEMBER_LOAN_PRODUCT,
          description: "Loan for external members, secured by their savings",
          minimum_amount: 1000,
          maximum_amount: 10000000,
          interest_rate: interestRate,
          interest_method: interestMethod,
          duration_months: durationMonths,
          repayment_frequency: "MONTHLY",
          processing_fee: 0,
          insurance_fee: 0,
          maximum_salary_deduction_percentage: 30,
          minimum_salary: 0,
          minimum_employment_period_months: 0,
          guarantor_required: false,
          collateral_required: false,
          active: true,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      product = created;
    }

    const { data: application, error } = await admin
      .from("loan_applications")
      .insert({
        organization_id: member.organization_id,
        member_id: member.id,
        loan_product_id: product.id,
        amount: requested,
        duration_months: durationMonths,
        interest_rate: interestRate,
        interest_method: interestMethod,
        total_interest: totalInterest,
        total_repayment: totalRepayment,
        monthly_deduction: monthlyDeduction,
        purpose: purpose?.trim() || "Member savings loan",
        status: "PENDING",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    await recordAudit({
      organizationId: member.organization_id,
      userId: user.id,
      action: "member.loan_requested",
      entityType: "loan_application",
      entityId: application.id,
      after: { amount: requested, savings: summary.savingsBalance },
    });

    return {
      ok: true,
      applicationId: application.id,
      success: "Loan application submitted for approval",
    };
  }

  async listMyLoans() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return [];

    const { data } = await admin
      .from("loan_applications")
      .select(
        "id, amount, status, total_repayment, monthly_deduction, duration_months, purpose, submitted_at, approved_at, disbursed_at, rejected_at, rejection_reason"
      )
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    return data ?? [];
  }

  async listMemberApplications() {
    if (!this.organizationId) return [];
    const { data } = await this.supabase
      .from("loan_applications")
      .select(
        "id, member_id, amount, status, total_repayment, submitted_at, purpose, members(first_name, last_name, member_number, joined_at)"
      )
      .eq("organization_id", this.organizationId)
      .not("member_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row) => {
      const member = row.members as unknown as {
        first_name: string;
        last_name: string;
        member_number: string;
        joined_at: string;
      } | null;
      return {
        ...row,
        memberName: member ? `${member.first_name} ${member.last_name}` : "Unknown member",
        memberNumber: member?.member_number ?? "",
        joinedAt: member?.joined_at ?? null,
      };
    });
  }

  async approveApplication(applicationId: string) {
    if (!this.organizationId || !this.userId) return { error: "Unauthorized" };
    if (!this.role || !MEMBER_APPROVER_ROLES.has(this.role)) {
      return { error: "You do not have permission to approve member loans" };
    }

    const admin = createAdminClient();
    const { data: application } = await admin
      .from("loan_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!application) return { error: "Loan application not found" };
    if (application.status !== "PENDING") {
      return { error: `Cannot approve an application in ${application.status} status` };
    }
    if (!application.member_id) {
      return { error: "This is not a member loan" };
    }

    const summary = await this.getSummaryForMember(application.member_id);
    if (!summary) return { error: "Member not found" };

    if (!summary.loanEligible) {
      return {
        error:
          summary.monthsRemaining > 0
            ? `This member is still ${summary.monthsRemaining} month(s) away from eligibility`
            : "This member is not eligible for a loan",
      };
    }
    if (Number(application.amount) > summary.maxLoan) {
      return {
        error: `Requested amount exceeds the member's limit of ${naira(summary.maxLoan)}`,
      };
    }

    const now = new Date();
    const ledger = LedgerService.createForOrganization(this.organizationId, this.userId);

    const posted = await ledger.postMemberLoanDisbursement(
      application.member_id,
      application.id,
      Number(application.amount)
    );
    if (posted.error) return { error: posted.error };

    const duration = Number(application.duration_months) || 6;
    const monthly = Number(application.monthly_deduction) || 0;
    const principalPerMonth = round2(Number(application.amount) / duration);
    const interestPerMonth = round2(Number(application.total_interest) / duration);

    const schedules = Array.from({ length: duration }, (_, index) => {
      const due = new Date(now);
      due.setMonth(due.getMonth() + index + 1);
      return {
        loan_application_id: application.id,
        month_number: index + 1,
        opening_balance: round2(Number(application.amount) - principalPerMonth * index),
        principal_payment: principalPerMonth,
        interest_payment: interestPerMonth,
        total_payment: round2(principalPerMonth + interestPerMonth),
        closing_balance: round2(
          Math.max(0, Number(application.amount) - principalPerMonth * (index + 1))
        ),
        status: "PENDING",
        due_date: due.toISOString().slice(0, 10),
        paid_amount: 0,
      };
    });

    const { error: scheduleError } = await admin
      .from("loan_schedules")
      .insert(schedules);
    if (scheduleError) return { error: scheduleError.message };

    const { error } = await admin
      .from("loan_applications")
      .update({
        status: "ACTIVE",
        approved_by: this.userId,
        approved_at: now.toISOString(),
        disbursed_at: now.toISOString(),
      })
      .eq("id", application.id);

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.loan_approved",
      entityType: "loan_application",
      entityId: application.id,
      after: { amount: Number(application.amount), monthly },
    });

    return {
      success: `Loan approved and ${naira(Number(application.amount))} credited to the member's wallet`,
    };
  }

  async rejectApplication(applicationId: string, reason: string) {
    if (!this.organizationId || !this.userId) return { error: "Unauthorized" };
    if (!this.role || !MEMBER_APPROVER_ROLES.has(this.role)) {
      return { error: "You do not have permission to reject member loans" };
    }
    if (!reason?.trim()) return { error: "A rejection reason is required" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("loan_applications")
      .update({
        status: "REJECTED",
        rejected_by: this.userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
      })
      .eq("id", applicationId)
      .eq("organization_id", this.organizationId)
      .eq("status", "PENDING");

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.loan_rejected",
      entityType: "loan_application",
      entityId: applicationId,
      after: { reason },
    });

    return { success: "Application rejected" };
  }
}
