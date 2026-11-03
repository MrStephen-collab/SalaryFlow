import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bankAccountSchema, withdrawalSchema } from "@/schemas/withdrawal";
import type { BankAccountValues } from "@/schemas/withdrawal";
import { getPaymentProvider } from "./payment-provider";
import { preparePaymentProvider } from "@/lib/platform-config";
import { recordAudit } from "./audit-service";

export class WithdrawalService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private admin = createAdminClient();
  private orgId: string | null = null;
  private userId: string | null = null;
  private employeeId: string | null = null;

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = new WithdrawalService(supabase);
    service.userId = user?.id ?? null;

    if (user) {
      const admin = createAdminClient();
      const [{ data: employee }, { data: profile }] = await Promise.all([
        admin
          .from("employees")
          .select("id, organization_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("user_profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      service.employeeId = employee?.id ?? null;
      service.orgId =
        employee?.organization_id ?? profile?.organization_id ?? null;
    }

    return service;
  }

  getEmployeeId() {
    return this.employeeId;
  }

  private mask(accountNumber: string) {
    const last4 = accountNumber.slice(-4);
    return `****${last4}`;
  }

  // ================= BANK ACCOUNTS =================

  async listBankAccounts(employeeId?: string) {
    if (!this.employeeId || !this.orgId) return [];

    const targetId = employeeId ?? this.employeeId;
    if (employeeId && employeeId !== this.employeeId) {
      // Admin can list any employee's accounts; employees only their own.
      const canView = await this.isAdmin();
      if (!canView) return [];
    }

    const { data } = await this.supabase
      .from("bank_accounts")
      .select("*")
      .eq("employee_id", targetId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    return (data ?? []).map((account) => ({
      ...account,
      masked: this.mask(account.account_number),
    }));
  }

  async getBankAccount(bankAccountId: string) {
    if (!this.orgId) return null;

    const { data } = await this.supabase
      .from("bank_accounts")
      .select("*")
      .eq("id", bankAccountId)
      .eq("organization_id", this.orgId)
      .single();

    return data ?? null;
  }

  async addBankAccount(values: BankAccountValues) {
    if (!this.orgId || !this.employeeId) {
      return { error: "No employee profile linked to this account" };
    }

    const parsed = bankAccountSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid bank details" };
    }

    const { data: existing, error: existingError } = await this.supabase
      .from("bank_accounts")
      .select("id")
      .eq("employee_id", this.employeeId)
      .eq("account_number", parsed.data.accountNumber)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) return { error: existingError.message };
    if (existing) return { error: "This account is already saved" };

    const { data: account, error } = await this.supabase
      .from("bank_accounts")
      .insert({
        organization_id: this.orgId,
        employee_id: this.employeeId,
        bank_name: parsed.data.bankName,
        bank_code: parsed.data.bankCode ?? null,
        account_number: parsed.data.accountNumber,
        account_name: parsed.data.accountName,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "withdrawal.bank_account_added",
      entityType: "bank_account",
      entityId: account.id,
      after: {
        bankName: account.bank_name,
        account: this.mask(account.account_number),
        accountName: account.account_name,
      },
    });

    return { success: "Bank account added", id: account.id };
  }

  async deleteBankAccount(bankAccountId: string) {
    if (!this.employeeId) return { error: "Unauthorized" };

    const { error } = await this.supabase
      .from("bank_accounts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", bankAccountId)
      .eq("employee_id", this.employeeId);

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "withdrawal.bank_account_removed",
      entityType: "bank_account",
      entityId: bankAccountId,
    });

    return { success: "Bank account removed" };
  }

  // ================= WITHDRAWAL REQUESTS =================

  async getAvailableBalance() {
    if (!this.employeeId) return 0;

    const { data: account } = await this.supabase
      .from("financial_accounts")
      .select("id")
      .eq("employee_id", this.employeeId)
      .eq("account_type", "AVAILABLE_BALANCE")
      .maybeSingle();

    if (!account) return 0;

    const ledger = await (await import("./ledger-service")).LedgerService.create();
    return ledger.getFinancialAccountBalance(account.id);
  }

  async requestWithdrawal(values: {
    amount: number;
    bankAccountId: string;
    pin?: string;
  }) {
    if (!this.orgId || !this.employeeId) {
      return { error: "No employee profile linked to this account" };
    }

    const parsed = withdrawalSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid withdrawal" };
    }

    // Verify the withdrawal PIN before proceeding.
    if (!values.pin || !/^\d{4}$/.test(values.pin)) {
      return { error: "Enter your 4-digit withdrawal PIN" };
    }
    const profile = await (await import("./profile-service")).ProfileService.create();
    const pinCheck = await profile.verifyWithdrawalPin(values.pin);
    if (pinCheck.error) return pinCheck;

    const account = await this.getBankAccount(parsed.data.bankAccountId);
    if (!account || account.employee_id !== this.employeeId) {
      return { error: "Bank account not found" };
    }

    const available = await this.getAvailableBalance();
    if (parsed.data.amount > available) {
      return {
        error: `Insufficient balance. You can withdraw up to ₦${available.toLocaleString()}`,
      };
    }

    const { data: pending } = await this.supabase
      .from("withdrawal_requests")
      .select("id")
      .eq("employee_id", this.employeeId)
      .in("status", ["PENDING", "REVIEW", "APPROVED", "PROCESSING"])
      .limit(1);

    if ((pending ?? []).length > 0) {
      return { error: "You already have a pending withdrawal request" };
    }

    const reference = `SLF-WDR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { data: created, error } = await this.supabase
      .from("withdrawal_requests")
      .insert({
        organization_id: this.orgId,
        employee_id: this.employeeId,
        bank_account_id: parsed.data.bankAccountId,
        amount: parsed.data.amount,
        fee: 0,
        net_amount: parsed.data.amount,
        status: "PENDING",
        reference,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { error: "Duplicate request detected. Please try again." };
      }
      return { error: error.message };
    }

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "withdrawal.requested",
      entityType: "withdrawal",
      entityId: created.id,
      after: {
        amount: parsed.data.amount,
        reference,
        status: "PENDING",
        bankName: account.bank_name,
        account: this.mask(account.account_number),
      },
    });

    return { success: "Withdrawal request submitted", reference };
  }

  async listWithdrawals(status?: string) {
    if (!this.orgId) return [];

    // Staff views use the service role: the table is locked down by RLS for
    // employee sessions, which made pending requests invisible to the chairman.
    let query = this.admin
      .from("withdrawal_requests")
      .select(
        `
        *,
        employees(employee_number, first_name, last_name),
        bank_accounts(bank_name, account_number)
      `
      )
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data } = await query;

    return (data ?? []).map((row) => {
      const employee = row.employees as unknown as {
        employee_number: string;
        first_name: string;
        last_name: string;
      } | null;
      const account = row.bank_accounts as unknown as {
        bank_name: string;
        account_number: string;
      } | null;
      return {
        ...row,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Unknown",
        employeeNumber: employee?.employee_number ?? "",
        bankName: account?.bank_name ?? "",
        masked: account ? this.mask(account.account_number) : "",
      };
    });
  }

  async listMyWithdrawals() {
    if (!this.employeeId) return [];

    const { data } = await this.supabase
      .from("withdrawal_requests")
      .select(
        `
        *,
        bank_accounts(bank_name, account_number)
      `
      )
      .eq("employee_id", this.employeeId)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const account = row.bank_accounts as unknown as {
        bank_name: string;
        account_number: string;
      } | null;
      return {
        ...row,
        bankName: account?.bank_name ?? "",
        masked: account ? this.mask(account.account_number) : "",
      };
    });
  }

  async getWithdrawal(withdrawalId: string) {
    if (!this.orgId) return null;

    const { data } = await this.admin
      .from("withdrawal_requests")
      .select(
        `
        *,
        employees(employee_number, first_name, last_name),
        bank_accounts(bank_name, bank_code, account_number, account_name)
      `
      )
      .eq("id", withdrawalId)
      .eq("organization_id", this.orgId)
      .single();

    if (!data) return null;

    const employee = data.employees as unknown as {
      employee_number: string;
      first_name: string;
      last_name: string;
    } | null;
    const account = data.bank_accounts as unknown as {
      bank_name: string;
      bank_code: string | null;
      account_number: string;
      account_name: string;
    } | null;

    return {
      ...data,
      employeeName: employee
        ? `${employee.first_name} ${employee.last_name}`
        : "Unknown",
      employeeNumber: employee?.employee_number ?? "",
      bankName: account?.bank_name ?? "",
      bankCode: account?.bank_code ?? "",
      accountName: account?.account_name ?? "",
      masked: account ? this.mask(account.account_number) : "",
    };
  }

  private async isAdmin() {
    if (!this.orgId) return false;
    const { data } = await this.supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", this.userId)
      .maybeSingle();
    const role = data?.role;
    return (
      role === "ORGANIZATION_OWNER" ||
      role === "ORGANIZATION_ADMIN" ||
      role === "FINANCE_MANAGER"
    );
  }

  // ================= WORKFLOW =================

  private async assertCanManage() {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };
    const admin = await this.isAdmin();
    if (!admin) return { error: "You do not have permission to manage withdrawals" };
    return null;
  }

  private async getOwned(id: string) {
    return this.supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", id)
      .eq("organization_id", this.orgId)
      .single();
  }

  private audit(
    action: string,
    withdrawalId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
  ) {
    return recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action,
      entityType: "withdrawal",
      entityId: withdrawalId,
      before,
      after,
    });
  }

  async submitForReview(withdrawalId: string, notes?: string) {
    const forbidden = await this.assertCanManage();
    if (forbidden) return forbidden;

    const { data: existing } = await this.getOwned(withdrawalId);
    if (!existing) return { error: "Withdrawal not found" };
    if (existing.status !== "PENDING") {
      return { error: `Cannot submit for review in ${existing.status} status` };
    }

    const { error } = await this.supabase
      .from("withdrawal_requests")
      .update({
        status: "REVIEW",
        reviewed_by: this.userId,
        reviewed_at: new Date().toISOString(),
        notes: notes ?? existing.notes,
      })
      .eq("id", withdrawalId);

    if (error) return { error: error.message };

    await this.audit(
      "withdrawal.review",
      withdrawalId,
      { status: existing.status },
      { status: "REVIEW", notes: notes ?? existing.notes }
    );

    return { success: "Withdrawal moved to review" };
  }

  async approve(withdrawalId: string, notes?: string) {
    const forbidden = await this.assertCanManage();
    if (forbidden) return forbidden;

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (profile?.role !== "ORGANIZATION_OWNER") {
      return { error: "Only the chairman can approve withdrawals" };
    }

    const { data: existing } = await this.getOwned(withdrawalId);
    if (!existing) return { error: "Withdrawal not found" };
    if (!["PENDING", "REVIEW"].includes(existing.status)) {
      return { error: `Cannot approve in ${existing.status} status` };
    }

    const { error } = await this.supabase
      .from("withdrawal_requests")
      .update({
        status: "APPROVED",
        approved_by: this.userId,
        approved_at: new Date().toISOString(),
        notes: notes ?? existing.notes,
      })
      .eq("id", withdrawalId);

    if (error) return { error: error.message };

    await this.audit(
      "withdrawal.approved",
      withdrawalId,
      { status: existing.status },
      {
        status: "APPROVED",
        amount: Number(existing.amount),
        reference: existing.reference,
        notes: notes ?? existing.notes,
      }
    );

    return { success: "Withdrawal approved" };
  }

  async reject(withdrawalId: string, reason: string) {
    const forbidden = await this.assertCanManage();
    if (forbidden) return forbidden;

    if (!reason) return { error: "Rejection reason is required" };

    const { data: existing } = await this.getOwned(withdrawalId);
    if (!existing) return { error: "Withdrawal not found" };
    if (!["PENDING", "REVIEW"].includes(existing.status)) {
      return { error: `Cannot reject in ${existing.status} status` };
    }

    const { error } = await this.supabase
      .from("withdrawal_requests")
      .update({
        status: "REJECTED",
        notes: reason,
      })
      .eq("id", withdrawalId);

    if (error) return { error: error.message };

    await this.audit(
      "withdrawal.rejected",
      withdrawalId,
      { status: existing.status },
      { status: "REJECTED", reason, amount: Number(existing.amount) }
    );

    return { success: "Withdrawal rejected" };
  }

  async process(withdrawalId: string) {
    const forbidden = await this.assertCanManage();
    if (forbidden) return forbidden;

    const { data: existing } = await this.getOwned(withdrawalId);
    if (!existing) return { error: "Withdrawal not found" };
    if (existing.status !== "APPROVED") {
      return { error: `Cannot process in ${existing.status} status` };
    }

    const account = await this.getBankAccount(existing.bank_account_id);
    if (!account) return { error: "Bank account not found" };

    await preparePaymentProvider();
    const provider = getPaymentProvider();
    const transfer = await provider.createTransfer({
      amount: Number(existing.net_amount),
      currency: "NGN",
      bankCode: account.bank_code ?? "",
      accountNumber: account.account_number,
      accountName: account.account_name,
      reference: existing.reference,
    });

    const { error } = await this.supabase
      .from("withdrawal_requests")
      .update({
        status: "PROCESSING",
        processed_by: this.userId,
        processed_at: new Date().toISOString(),
        provider_reference: transfer.providerReference ?? existing.reference,
      })
      .eq("id", withdrawalId);

    if (error) return { error: error.message };

    await this.audit(
      "withdrawal.processing",
      withdrawalId,
      { status: existing.status },
      {
        status: "PROCESSING",
        providerReference: transfer.providerReference ?? existing.reference,
        providerOk: transfer.ok,
        providerNote: transfer.error ?? null,
      }
    );

    if (!transfer.ok && transfer.error) {
      return {
        success: "Withdrawal moved to processing (manual settlement required)",
        note: transfer.error,
      };
    }

    return { success: "Withdrawal processing (awaiting settlement verification)" };
  }

  async markPaid(withdrawalId: string, externalReference: string) {
    const forbidden = await this.assertCanManage();
    if (forbidden) return forbidden;

    const { data: existing } = await this.getOwned(withdrawalId);
    if (!existing) return { error: "Withdrawal not found" };
    if (existing.status !== "PROCESSING") {
      return { error: `Cannot confirm payment in ${existing.status} status` };
    }

    await preparePaymentProvider();
    const provider = getPaymentProvider();
    const settlementReference = String(externalReference ?? "").trim();
    const providerReference = existing.provider_reference ?? existing.reference;

    // A failed or unavailable gateway payout falls back to manual settlement,
    // in which case the provider reference is just the internal withdrawal
    // reference. There is no gateway transfer to verify, so the chairman's
    // settlement reference (or the internal reference as a fallback) is the
    // proof of payment.
    const manualSettlement =
      provider.name === "manual" ||
      !existing.provider_reference ||
      existing.provider_reference === existing.reference;

    if (!manualSettlement) {
      const verification = await provider.verifyTransfer(
        providerReference,
        settlementReference
      );
      if (!verification.verified) {
        return { error: verification.error ?? "Settlement could not be verified" };
      }
    }

    const referenceUsed =
      settlementReference || providerReference || existing.reference;

    const { error } = await this.supabase
      .from("withdrawal_requests")
      .update({
        status: "PAID",
        paid_at: new Date().toISOString(),
        provider_reference: referenceUsed,
      })
      .eq("id", withdrawalId);

    if (error) return { error: error.message };

    await this.audit(
      "withdrawal.paid",
      withdrawalId,
      { status: existing.status },
      {
        status: "PAID",
        amount: Number(existing.amount),
        reference: existing.reference,
        providerReference: referenceUsed,
        manualSettlement,
      }
    );

    const ledger = await (await import("./ledger-service")).LedgerService.create();
    const ledgerResult = await ledger.postWithdrawal(
      existing.employee_id,
      withdrawalId,
      Number(existing.amount)
    );
    if (ledgerResult.error) {
      return { error: `Withdrawal paid but ledger error: ${ledgerResult.error}` };
    }

    const fund = await (await import("./fund-service")).FundService.create();
    const fundAccounts = await fund.listFundAccounts();
    const primaryFund = fundAccounts.find((f) => f.status === "ACTIVE");
    if (primaryFund) {
      await fund.recordMovement(
        primaryFund.id,
        "WITHDRAWAL",
        Number(existing.amount),
        "OUT",
        `Withdrawal payout #${withdrawalId.slice(0, 8)}`,
        undefined
      );
    }

    return { success: "Withdrawal marked as paid" };
  }

  async fail(withdrawalId: string, reason: string) {
    const forbidden = await this.assertCanManage();
    if (forbidden) return forbidden;

    if (!reason) return { error: "Failure reason is required" };

    const { data: existing } = await this.getOwned(withdrawalId);
    if (!existing) return { error: "Withdrawal not found" };
    if (existing.status !== "PROCESSING") {
      return { error: `Cannot fail in ${existing.status} status` };
    }

    const { error } = await this.supabase
      .from("withdrawal_requests")
      .update({
        status: "FAILED",
        failure_reason: reason,
      })
      .eq("id", withdrawalId);

    if (error) return { error: error.message };

    await this.audit(
      "withdrawal.failed",
      withdrawalId,
      { status: existing.status },
      { status: "FAILED", reason, amount: Number(existing.amount) }
    );

    return { success: "Withdrawal marked as failed" };
  }
}