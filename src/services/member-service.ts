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
      .select("*")
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
    nin?: string;
    ninDocumentUrl?: string;
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
    const nin = values.nin?.trim();
    if (!nin || !/^\d{11}$/.test(nin)) {
      return { ok: false, error: "NIN must be 11 digits" };
    }
    if (!values.ninDocumentUrl) {
      return { ok: false, error: "Upload the member's NIN document" };
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
        nin,
        nin_document_url: values.ninDocumentUrl,
        status: "PENDING",
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

  /** The signed-in member's own record. */
  async getMyMember() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select(
        "id, organization_id, member_number, first_name, last_name, email, phone, status, kyc_status, joined_at, nin, nin_document_url, nin_status, address, date_of_birth"
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return null;

    const { data: organization } = await admin
      .from("organizations")
      .select("name, address, state, lga")
      .eq("id", member.organization_id)
      .maybeSingle();

    return { ...member, organizationName: organization?.name ?? null };
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

  /** Member analytics for the employer dashboard. */
  async getMembersOverview() {
    if (!this.organizationId) {
      return null;
    }

    const admin = createAdminClient();

    const { data: members, error: membersError } = await admin
      .from("members")
      .select("id, status, member_number, first_name, last_name, email, joined_at, nin, nin_status")
      .eq("organization_id", this.organizationId);

    if (membersError) {
      return null;
    }

    const memberRows = members ?? [];
    const activeCount = memberRows.filter((member) => member.status === "ACTIVE").length;
    const pendingCount = memberRows.filter((member) => member.status === "PENDING").length;

    const { data: savingsTransactions } = await admin
      .from("savings_transactions")
      .select("transaction_type, amount, member_id")
      .eq("organization_id", this.organizationId);

    let savingsDeposited = 0;
    let savingsLent = 0;
    for (const tx of savingsTransactions ?? []) {
      const amount = Number(tx.amount) || 0;
      if (tx.transaction_type === "DEPOSIT") savingsDeposited += amount;
      if (tx.transaction_type === "LOAN_DISBURSEMENT") savingsLent += amount;
    }

    const { data: memberLoans } = await admin
      .from("loan_applications")
      .select("amount, status, member_id")
      .eq("organization_id", this.organizationId)
      .not("member_id", "is", null);

    for (const loan of memberLoans ?? []) {
      if (loan.status === "DISBURSED" || loan.status === "ACTIVE") {
        savingsLent += Number(loan.amount) || 0;
      }
    }

    return {
      members: memberRows.length,
      active: activeCount,
      pending: pendingCount,
      savingsDeposited: Math.round(savingsDeposited * 100) / 100,
      savingsLent: Math.round(savingsLent * 100) / 100,
      memberRows,
    };
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
      .eq("account_type", "WALLET")
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

    const savingsBalance = Math.max(0, round2(totalDeposited - totalWithdrawn));
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
    purpose: string,
    collateral?: { description?: string; documentUrl?: string }
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
      .select(
        "default_interest_rate, default_interest_method, member_loan_interest_rate, member_loan_collateral_required, member_loan_processing_fee_percentage, member_loan_duration_months"
      )
      .eq("organization_id", member.organization_id)
      .maybeSingle();

    // Loan terms come from the Member Savings Loan product (editable on the
    // Loans page). Organization settings are only used to seed the product.
    let { data: product } = await admin
      .from("loan_products")
      .select(
        "id, interest_rate, interest_method, duration_months, processing_fee, insurance_fee, collateral_required, minimum_amount, maximum_amount, active"
      )
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
          interest_rate: Number(
            settings?.member_loan_interest_rate ?? 1
          ),
          interest_method: settings?.default_interest_method ?? "FLAT",
          duration_months: Number(settings?.member_loan_duration_months ?? 6),
          repayment_frequency: "MONTHLY",
          processing_fee: 0,
          insurance_fee: 0,
          maximum_salary_deduction_percentage: 30,
          minimum_salary: 0,
          minimum_employment_period_months: 0,
          guarantor_required: false,
          collateral_required: Boolean(
            settings?.member_loan_collateral_required
          ),
          active: true,
        })
        .select(
          "id, interest_rate, interest_method, duration_months, processing_fee, insurance_fee, collateral_required, minimum_amount, maximum_amount, active"
        )
        .single();
      if (error) return { ok: false, error: error.message };
      product = created;
    }

    const interestRate = Number(
      member.loan_interest_rate ?? product.interest_rate ?? 1
    );
    const interestMethod = product.interest_method ?? "FLAT";
    const durationMonths = Number(product.duration_months ?? 6);
    const processingFee = round2(Number(product.processing_fee) || 0);
    const insuranceFee = round2(Number(product.insurance_fee) || 0);
    const collateralRequired = Boolean(product.collateral_required);

    if (collateralRequired) {
      if (!collateral?.description?.trim()) {
        return { ok: false, error: "Collateral description is required" };
      }
      if (!collateral?.documentUrl) {
        return { ok: false, error: "Collateral document is required" };
      }
    }

    const totalInterest = round2((requested * interestRate) / 100);
    const totalRepayment = round2(requested + totalInterest);
    const monthlyDeduction = round2(totalRepayment / durationMonths);

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
        status: "SUBMITTED",
        processing_fee: processingFee,
        insurance_fee: insuranceFee,
        collateral_description: collateral?.description?.trim() || null,
        collateral_document_url: collateral?.documentUrl || null,
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
        "id, amount, status, total_interest, processing_fee, insurance_fee, total_repayment, monthly_deduction, duration_months, purpose, submitted_at, approved_at, disbursed_at, rejected_at, rejection_reason, collateral_description, collateral_document_url"
      )
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    const loans = data ?? [];
    const ids = loans.map((loan) => loan.id as string);
    const paidByLoan = new Map<string, number>();

    if (ids.length > 0) {
      const { data: schedules } = await admin
        .from("loan_schedules")
        .select("loan_application_id, total_payment, paid_amount, status")
        .in("loan_application_id", ids);

      for (const schedule of schedules ?? []) {
        const id = schedule.loan_application_id as string;
        paidByLoan.set(
          id,
          (paidByLoan.get(id) ?? 0) + (Number(schedule.paid_amount) || 0)
        );
      }
    }

    return loans.map((loan) => {
      const total = Number(loan.total_repayment) || 0;
      const paid = Math.round((paidByLoan.get(loan.id as string) ?? 0) * 100) / 100;
      return {
        ...loan,
        paidAmount: paid,
        outstanding: Math.max(0, Math.round((total - paid) * 100) / 100),
        progressPercent:
          total > 0 ? Math.min(100, Math.round((paid / total) * 1000) / 10) : 0,
      };
    });
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

  async updateMember(
    memberId: string,
    values: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      address?: string;
      dateOfBirth?: string;
      nin?: string;
      ninDocumentUrl?: string;
      loanInterestRate?: number | null;
    }
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.organizationId || !this.userId) {
      return { ok: false, error: "Unauthorized" };
    }
    if (!this.role || !MEMBER_STAFF_ROLES.has(this.role)) {
      return { ok: false, error: "You do not have permission to manage members" };
    }

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id")
      .eq("id", memberId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!member) return { ok: false, error: "Member not found" };

    const { error } = await admin
      .from("members")
      .update({
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        phone: values.phone || null,
        address: values.address || null,
        date_of_birth: values.dateOfBirth || null,
        nin: values.nin || null,
        nin_document_url: values.ninDocumentUrl || null,
        loan_interest_rate:
          values.loanInterestRate === undefined || values.loanInterestRate === null
            ? null
            : Number(values.loanInterestRate),
      })
      .eq("id", memberId);

    if (error) return { ok: false, error: error.message };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.updated",
      entityType: "member",
      entityId: memberId,
      after: {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
      },
    });

    return { ok: true };
  }

  async approveMembership(
    memberId: string
  ): Promise<{ ok: boolean; already?: boolean; error?: string }> {
    if (!this.organizationId || !this.userId) return { ok: false, error: "Unauthorized" };
    if (!this.role || !MEMBER_APPROVER_ROLES.has(this.role)) {
      return { ok: false, error: "You do not have permission to approve members" };
    }

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id, status")
      .eq("id", memberId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!member) return { ok: false, error: "Member not found" };
    if (member.status === "ACTIVE") {
      return { ok: true, already: true };
    }

    const { error } = await admin
      .from("members")
      .update({ status: "ACTIVE" })
      .eq("id", memberId);

    if (error) return { ok: false, error: error.message };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.approved",
      entityType: "member",
      entityId: memberId,
      after: { status: "ACTIVE" },
    });

    return { ok: true };
  }

  /** Terms the employer configured for member loans. */
  async getLoanTerms() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("organization_id, loan_interest_rate")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return null;

    const { data: product } = await admin
      .from("loan_products")
      .select(
        "interest_rate, processing_fee, insurance_fee, duration_months, collateral_required"
      )
      .eq("organization_id", member.organization_id)
      .eq("name", MEMBER_LOAN_PRODUCT)
      .maybeSingle();

    return {
      interestRate: Number(member.loan_interest_rate ?? product?.interest_rate ?? 1),
      processingFee: Number(product?.processing_fee ?? 0),
      insuranceFee: Number(product?.insurance_fee ?? 0),
      durationMonths: Number(product?.duration_months ?? 6),
      collateralRequired: Boolean(product?.collateral_required),
    };
  }

  /** Admin/chairman: active member loans with outstanding balances. */
  async listActiveMemberLoans() {
    if (!this.organizationId) return [];
    const admin = createAdminClient();

    const { data: loans } = await admin
      .from("loan_applications")
      .select(
        `
        id, amount, total_repayment, monthly_deduction, duration_months, status,
        members:member_id(first_name, last_name, member_number),
        loan_schedules(total_payment, paid_amount, status)
      `
      )
      .eq("organization_id", this.organizationId)
      .not("member_id", "is", null)
      .in("status", ["ACTIVE", "DISBURSED"])
      .order("created_at", { ascending: false });

    return (loans ?? []).map((loan) => {
      const member = loan.members as unknown as {
        first_name: string;
        last_name: string;
        member_number: string;
      } | null;
      const schedules = (loan.loan_schedules as unknown as
        | { total_payment: number; paid_amount: number; status: string }[]
        | null) ?? [];
      const paid = schedules.reduce(
        (sum, s) => sum + (Number(s.paid_amount) || 0),
        0
      );
      const total = Number(loan.total_repayment) || 0;

      return {
        id: loan.id as string,
        memberName: member ? `${member.first_name} ${member.last_name}` : "Unknown member",
        memberNumber: member?.member_number ?? "",
        amount: Number(loan.amount) || 0,
        total,
        paid: Math.round(paid * 100) / 100,
        outstanding: Math.max(0, Math.round((total - paid) * 100) / 100),
        monthly: Number(loan.monthly_deduction) || 0,
        status: loan.status as string,
      };
    });
  }

  /**
   * Record a member loan repayment. The principal portion rebuilds the member's
   * savings (which determines the next loan limit); the interest portion is the
   * organization's loan income.
   */
  async recordMemberRepayment(applicationId: string, amount: number) {
    if (!this.organizationId || !this.userId) {
      return { ok: false, error: "Unauthorized" };
    }
    if (!this.role || !MEMBER_APPROVER_ROLES.has(this.role)) {
      return { ok: false, error: "You do not have permission to record repayments" };
    }

    const requested = round2(Number(amount));
    if (!Number.isFinite(requested) || requested <= 0) {
      return { ok: false, error: "Enter a valid repayment amount" };
    }

    const admin = createAdminClient();
    const { data: loan } = await admin
      .from("loan_applications")
      .select("id, member_id, status, total_repayment")
      .eq("id", applicationId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!loan) return { ok: false, error: "Member loan not found" };
    if (!loan.member_id) return { ok: false, error: "This is not a member loan" };
    if (!["ACTIVE", "DISBURSED"].includes(loan.status)) {
      return { ok: false, error: `Cannot repay a loan in ${loan.status} status` };
    }

    const { data: schedules } = await admin
      .from("loan_schedules")
      .select("id, total_payment, paid_amount, interest_payment, status, month_number")
      .eq("loan_application_id", applicationId)
      .in("status", ["UPCOMING", "DUE", "LATE", "PARTIAL"])
      .order("month_number", { ascending: true });

    if (!schedules?.length) {
      return { ok: false, error: "This loan has no outstanding instalments" };
    }

    let remaining = requested;
    let principalSaved = 0;
    let interestPaid = 0;
    let applied = 0;

    for (const schedule of schedules) {
      if (remaining <= 0) break;
      const due = round2(Number(schedule.total_payment) - Number(schedule.paid_amount));
      if (due <= 0.005) continue;

      const portion = round2(Math.min(remaining, due));
      const interestPortion = round2(
        Math.min(
          Number(schedule.interest_payment) || 0,
          (Number(schedule.interest_payment) || 0) * (portion / due)
        )
      );
      const principalPortion = round2(portion - interestPortion);
      const newPaid = round2(Number(schedule.paid_amount) + portion);
      const fullyPaid = newPaid >= Number(schedule.total_payment) - 0.01;

      await admin
        .from("loan_schedules")
        .update({
          paid_amount: newPaid,
          status: fullyPaid ? "PAID" : "LATE",
          paid_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      remaining = round2(remaining - portion);
      principalSaved = round2(principalSaved + principalPortion);
      interestPaid = round2(interestPaid + interestPortion);
      applied = round2(applied + portion);
    }

    if (applied <= 0) {
      return { ok: false, error: "That amount does not cover any instalment" };
    }

    const ledger = LedgerService.createForOrganization(
      this.organizationId,
      this.userId
    );
    const posted = await ledger.postLoanRepayment(
      "",
      applicationId,
      applied,
      principalSaved,
      interestPaid
    );
    if (posted.error) return { ok: false, error: posted.error };

    const wallet = await ledger.ensureMemberFinancialAccount(loan.member_id);
    if (wallet?.id && principalSaved > 0) {
      await admin.from("savings_transactions").insert({
        organization_id: this.organizationId,
        member_id: loan.member_id,
        financial_account_id: wallet.id,
        transaction_type: "DEPOSIT",
        amount: principalSaved,
        direction: "IN",
        reference: `SAV-REPAY-${applicationId.slice(0, 8)}-${Date.now()}`,
        description: "Fresh savings from loan repayment",
      });
    }

    const { data: allSchedules } = await admin
      .from("loan_schedules")
      .select("status")
      .eq("loan_application_id", applicationId);

    const completed =
      allSchedules?.length &&
      allSchedules.every((s) => s.status === "PAID" || s.status === "WAIVED");

    if (completed) {
      await admin
        .from("loan_applications")
        .update({ status: "COMPLETED" })
        .eq("id", applicationId);
    }

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.loan_repayment_recorded",
      entityType: "loan_application",
      entityId: applicationId,
      after: {
        amount: applied,
        savings: principalSaved,
        interest: interestPaid,
        completed,
      },
    });

    return {
      ok: true,
      applied,
      savings: principalSaved,
      interest: interestPaid,
      completed,
    };
  }

  /** Member's saved withdrawal bank accounts. */
  async listMyBankAccounts() {
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
      .from("bank_accounts")
      .select("id, bank_name, bank_code, account_number, account_name, is_default")
      .eq("member_id", member.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    return data ?? [];
  }

  async addBankAccount(values: {
    bankName: string;
    bankCode?: string;
    accountNumber: string;
    accountName: string;
  }): Promise<{ ok: boolean; error?: string; success?: string }> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id, organization_id, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { ok: false, error: "No member profile is linked to this account" };

    const bankName = values.bankName?.trim();
    const accountNumber = values.accountNumber?.trim();
    const accountName = values.accountName?.trim();

    if (!bankName) return { ok: false, error: "Bank name is required" };
    if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
      return { ok: false, error: "Account number must be 10 digits" };
    }
    if (!accountName) return { ok: false, error: "Account name is required" };

    const { data: existing } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("member_id", member.id)
      .eq("account_number", accountNumber)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) {
      return { ok: false, error: "This account has already been added" };
    }

    const { count } = await admin
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .is("deleted_at", null);

    const { error } = await admin.from("bank_accounts").insert({
      organization_id: member.organization_id,
      member_id: member.id,
      bank_name: bankName,
      bank_code: values.bankCode?.trim() || null,
      account_number: accountNumber,
      account_name: accountName,
      is_default: (count ?? 0) === 0,
      verified: false,
    });

    if (error) return { ok: false, error: error.message };

    return { ok: true, success: "Bank account added" };
  }

  async removeBankAccount(accountId: string) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { ok: false, error: "No member profile found" };

    const { error } = await admin
      .from("bank_accounts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("member_id", member.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true, success: "Bank account removed" };
  }

  /** Member requests a withdrawal from their savings wallet. */
  async requestWithdrawal(amount: number, bankAccountId?: string) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id, organization_id, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { ok: false, error: "No member profile is linked to this account" };
    if (member.status !== "ACTIVE") {
      return { ok: false, error: "Your membership is not active" };
    }

    const requested = round2(Number(amount));
    if (!Number.isFinite(requested) || requested <= 0) {
      return { ok: false, error: "Enter a valid amount" };
    }

    const summary = await this.getMySummary();
    if (!summary) return { ok: false, error: "Member profile not found" };
    if (requested > summary.walletBalance) {
      return {
        ok: false,
        error: `You can withdraw up to ${naira(summary.walletBalance)}`,
      };
    }

    if (!bankAccountId) {
      return { ok: false, error: "Add a bank account before requesting a withdrawal" };
    }

    const { data: account } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("id", bankAccountId)
      .eq("member_id", member.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!account) return { ok: false, error: "Select a valid bank account" };

    const { error } = await admin.from("withdrawal_requests").insert({
      organization_id: member.organization_id,
      member_id: member.id,
      bank_account_id: bankAccountId,
      amount: requested,
      fee: 0,
      net_amount: requested,
      status: "PENDING",
      reference: `SF-MWD-${Date.now()}`,
      notes: "Member savings withdrawal request",
    });

    if (error) return { ok: false, error: error.message };

    await recordAudit({
      organizationId: member.organization_id,
      userId: user.id,
      action: "member.withdrawal_requested",
      entityType: "withdrawal",
      entityId: member.id,
      after: { amount: requested },
    });

    return { ok: true, success: "Withdrawal request submitted for approval" };
  }

  async listMyWithdrawals() {
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
      .from("withdrawal_requests")
      .select("id, amount, net_amount, status, reference, created_at, paid_at, failure_reason")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    return data ?? [];
  }

  async listMemberWithdrawals() {
    if (!this.organizationId) return [];
    const admin = createAdminClient();

    const { data } = await admin
      .from("withdrawal_requests")
      .select(
        "id, amount, net_amount, status, reference, created_at, members:member_id(first_name, last_name, member_number), bank_accounts:bank_account_id(bank_name, account_number, account_name)"
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
      } | null;
      const account = row.bank_accounts as unknown as {
        bank_name: string | null;
        account_number: string | null;
        account_name: string | null;
      } | null;
      return {
        id: row.id as string,
        memberName: member ? `${member.first_name} ${member.last_name}` : "Unknown member",
        memberNumber: member?.member_number ?? "",
        amount: Number(row.amount) || 0,
        status: row.status as string,
        reference: row.reference as string,
        createdAt: row.created_at as string,
        bankName: account?.bank_name ?? "",
        accountNumber: account?.account_number
          ? `••••${account.account_number.slice(-4)}`
          : "",
        accountName: account?.account_name ?? "",
      };
    });
  }

  /** Chairman approves a pending member withdrawal. */
  async approveMemberWithdrawal(withdrawalId: string) {
    if (!this.organizationId || !this.userId) {
      return { ok: false, error: "Unauthorized" };
    }
    if (this.role !== "ORGANIZATION_OWNER") {
      return { ok: false, error: "Only the chairman can approve member withdrawals" };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("withdrawal_requests")
      .update({
        status: "APPROVED",
        approved_by: this.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId)
      .eq("organization_id", this.organizationId)
      .eq("status", "PENDING");

    if (error) return { ok: false, error: error.message };
    return { ok: true, success: "Withdrawal approved" };
  }

  /** Pay an approved member withdrawal from the savings wallet. */
  async payMemberWithdrawal(withdrawalId: string) {
    if (!this.organizationId || !this.userId) {
      return { ok: false, error: "Unauthorized" };
    }
    if (!this.role || !MEMBER_APPROVER_ROLES.has(this.role)) {
      return { ok: false, error: "You do not have permission to pay withdrawals" };
    }

    const admin = createAdminClient();
    const { data: request } = await admin
      .from("withdrawal_requests")
      .select("id, member_id, amount, status")
      .eq("id", withdrawalId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!request) return { ok: false, error: "Withdrawal not found" };
    if (!request.member_id) return { ok: false, error: "This is not a member withdrawal" };
    if (request.status !== "APPROVED") {
      return { ok: false, error: `Cannot pay a withdrawal in ${request.status} status` };
    }

    const amount = round2(Number(request.amount) || 0);
    const ledger = LedgerService.createForOrganization(this.organizationId, this.userId);
    const posted = await ledger.postMemberWalletWithdrawal(
      request.member_id,
      `SLF-MWD-${request.id.slice(0, 8)}`,
      amount,
      "Member wallet withdrawal"
    );
    if (posted.error) return { ok: false, error: posted.error };

    const { error } = await admin
      .from("withdrawal_requests")
      .update({
        status: "PAID",
        paid_at: new Date().toISOString(),
        processed_by: this.userId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    if (error) return { ok: false, error: error.message };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "member.withdrawal_paid",
      entityType: "withdrawal",
      entityId: withdrawalId,
      after: { amount },
    });

    return { ok: true, success: "Withdrawal marked as paid" };
  }

  async approveApplication(applicationId: string) {
    if (!this.organizationId || !this.userId) return { error: "Unauthorized" };
    if (!this.role || !MEMBER_APPROVER_ROLES.has(this.role)) {
      return { error: "You do not have permission to approve member loans" };
    }
    if (this.role !== "ORGANIZATION_OWNER") {
      return { error: "Only the chairman can approve and disburse member loans" };
    }

    const admin = createAdminClient();
    const { data: application } = await admin
      .from("loan_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!application) return { error: "Loan application not found" };
    if (!["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
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

    // No approval without the required documents.
    const { data: memberDocs } = await admin
      .from("members")
      .select("nin, nin_document_url")
      .eq("id", application.member_id)
      .maybeSingle();

    if (!memberDocs?.nin || !memberDocs?.nin_document_url) {
      return {
        error:
          "Cannot approve: the member's NIN and NIN document must be submitted first",
      };
    }

    const { data: loanTerms } = await admin
      .from("loan_products")
      .select("collateral_required")
      .eq("id", application.loan_product_id)
      .maybeSingle();

    if (
      loanTerms?.collateral_required &&
      !application.collateral_document_url
    ) {
      return {
        error:
          "Cannot approve: a collateral document is required for member loans",
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
      Number(application.amount),
      round2(
        (Number(application.processing_fee) || 0) +
          (Number(application.insurance_fee) || 0)
      )
    );
    if (posted.error) return { error: posted.error };

    // The savings that secured this loan are consumed at disbursement. Fresh
    // savings start accumulating again as the member repays.
    if (summary.savingsBalance > 0) {
      const wallet = await ledger.ensureMemberFinancialAccount(application.member_id);
      if (wallet?.id) {
        await admin.from("savings_transactions").insert({
          organization_id: this.organizationId,
          member_id: application.member_id,
          financial_account_id: wallet.id,
          transaction_type: "WITHDRAWAL",
          amount: summary.savingsBalance,
          direction: "OUT",
          reference: `SAV-LOAN-${application.id.slice(0, 8)}`,
          description: "Savings applied to member loan — fresh savings start with repayment",
        });
      }
    }

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
        status: "UPCOMING",
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
      .in("status", ["PENDING", "SUBMITTED", "UNDER_REVIEW"]);

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
