import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "./audit-service";

export interface LedgerEntryInput {
  accountId?: string;
  financialAccountId?: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface LedgerTransactionInput {
  description: string;
  transactionType: string;
  entries: LedgerEntryInput[];
}

/**
 * Implements a double-entry accounting ledger.
 *
 * Every transaction must be balanced (total debits == total credits) or it
 * fails. Transactions are immutable once posted; corrections use reversals.
 */
export class LedgerService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;
  private userId: string | null = null;

  private constructor(
    supabase: Awaited<ReturnType<typeof createClient>>
  ) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let orgId: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      orgId = profile?.organization_id ?? null;
    }

    const service = new LedgerService(supabase);
    service.orgId = orgId;
    service.userId = user?.id ?? null;
    return service;
  }

  /**
   * Service-role variant for jobs with no user session (payment webhooks,
   * scheduled disbursement runs). The organization must be supplied explicitly
   * because there is no session to read it from.
   */
  static createForOrganization(organizationId: string, actorUserId?: string | null) {
    const supabase = createAdminClient() as unknown as Awaited<
      ReturnType<typeof createClient>
    >;
    const service = new LedgerService(supabase);
    service.orgId = organizationId;
    service.userId = actorUserId ?? null;
    return service;
  }

  /**
   * Post a balanced double-entry transaction.
   * Fails if debits != credits, or if no entries, or no org.
   */
  async postTransaction(
    input: LedgerTransactionInput,
    reference?: string
  ): Promise<{ success?: string; reference?: string; error?: string; id?: string }> {
    if (!this.orgId) return { error: "No organization found" };

    if (input.entries.length === 0) {
      return { error: "Transaction must have at least one entry" };
    }

    const totalDebit = input.entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const totalCredit = input.entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      return {
        error: `Unbalanced transaction: debit ${totalDebit} != credit ${totalCredit}`,
      };
    }

    const txReference =
      reference ?? `SLF-TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { data: tx, error: txError } = await this.supabase
      .from("ledger_transactions")
      .insert({
        organization_id: this.orgId,
        reference: txReference,
        description: input.description,
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: input.transactionType,
        status: "POSTED",
        created_by: this.userId,
      })
      .select()
      .single();

    if (txError) return { error: txError.message };

    const entries = input.entries.map((e) => ({
      organization_id: this.orgId,
      transaction_id: tx.id,
      account_id: e.accountId ?? null,
      financial_account_id: e.financialAccountId ?? null,
      description: e.description ?? input.description,
      debit: Number(e.debit) || 0,
      credit: Number(e.credit) || 0,
    }));

    const { error: entriesError } = await this.supabase
      .from("ledger_entries")
      .insert(entries);

    if (entriesError) return { error: entriesError.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "ledger.transaction_posted",
      entityType: "ledger_transaction",
      entityId: tx.id,
      after: {
        reference: txReference,
        transactionType: input.transactionType,
        description: input.description,
        totalDebit,
        entries: entries.length,
      },
    });

    return { success: "Transaction posted", reference: txReference, id: tx.id };
  }

  /**
   * Reverse a posted transaction. The original is never deleted.
   * Creates a mirror transaction with debits/credits swapped and links it via
   * the reversal_of column; flips the original status to REVERSED.
   */
  async reverseTransaction(
    transactionId: string,
    reason: string
  ): Promise<{ success?: string; error?: string }> {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: tx } = await this.supabase
      .from("ledger_transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("organization_id", this.orgId)
      .single();

    if (!tx) return { error: "Transaction not found" };
    if (tx.status === "REVERSED") return { error: "Transaction is already reversed" };
    if (tx.reversal_of) return { error: "Cannot reverse a reversal" };

    const { data: entries } = await this.supabase
      .from("ledger_entries")
      .select("*")
      .eq("transaction_id", transactionId);

    const reversalReference = `SLF-REV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { data: reversalTx, error: revError } = await this.supabase
      .from("ledger_transactions")
      .insert({
        organization_id: this.orgId,
        reference: reversalReference,
        description: `REVERSAL: ${reason} (of ${tx.reference})`,
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: `${tx.transaction_type}_REVERSAL`,
        status: "POSTED",
        reversal_of: tx.id,
        created_by: this.userId,
      })
      .select()
      .single();

    if (revError) return { error: revError.message };

    const reversalEntries = (entries ?? []).map((e) => ({
      organization_id: this.orgId,
      transaction_id: reversalTx.id,
      account_id: e.account_id,
      financial_account_id: e.financial_account_id,
      description: `REVERSAL: ${reason}`,
      debit: Number(e.credit) || 0,
      credit: Number(e.debit) || 0,
    }));

    const { error: entryError } = await this.supabase
      .from("ledger_entries")
      .insert(reversalEntries);

    if (entryError) return { error: entryError.message };

    await this.supabase
      .from("ledger_transactions")
      .update({ status: "REVERSED" })
      .eq("id", transactionId)
      .eq("organization_id", this.orgId);

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "ledger.transaction_reversed",
      entityType: "ledger_transaction",
      entityId: transactionId,
      before: { status: tx.status, reference: tx.reference },
      after: {
        status: "REVERSED",
        reason,
        reversalReference,
        reversalTransactionId: reversalTx.id,
      },
    });

    return { success: "Transaction reversed" };
  }

  async listTransactions(limit = 100) {
    if (!this.orgId) return [];

    const { data } = await this.supabase
      .from("ledger_transactions")
      .select("*")
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return data ?? [];
  }

  async getTransaction(transactionId: string) {
    if (!this.orgId) return null;

    const { data: tx } = await this.supabase
      .from("ledger_transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("organization_id", this.orgId)
      .single();

    if (!tx) return null;

    const { data: entries } = await this.supabase
      .from("ledger_entries")
      .select("*")
      .eq("transaction_id", transactionId);

    return { ...tx, entries: entries ?? [] };
  }

  /**
   * Ensure the default chart of accounts exists for the organization.
   */
  async ensureChartOfAccounts() {
    if (!this.orgId) return;

    const defaults = [
      { code: "1000", name: "Lending Fund", type: "ASSET" },
      { code: "1100", name: "Loan Receivable", type: "ASSET" },
      { code: "2000", name: "Loan Principal", type: "LIABILITY" },
      { code: "4000", name: "Interest Income", type: "INCOME" },
      { code: "4100", name: "Gateway & Other Income", type: "INCOME" },
      { code: "5000", name: "Salary Expense", type: "EXPENSE" },
      { code: "5100", name: "Gateway Fees", type: "EXPENSE" },
    ];

    const { data } = await this.supabase
      .from("ledger_accounts")
      .select("code")
      .eq("organization_id", this.orgId);

    const existing = new Set((data ?? []).map((a) => a.code));

    const toInsert = defaults
      .filter((d) => !existing.has(d.code))
      .map((d) => ({ ...d, organization_id: this.orgId }));

    if (toInsert.length > 0) {
      await this.supabase.from("ledger_accounts").insert(toInsert);
    }
  }

  async getAccountByCode(code: string) {
    if (!this.orgId) return null;
    const { data } = await this.supabase
      .from("ledger_accounts")
      .select("id")
      .eq("organization_id", this.orgId)
      .eq("code", code)
      .single();
    return data ?? null;
  }

  /**
   * Ensure an AVAILABLE_BALANCE financial account exists for an employee.
   */
  async ensureFinancialAccount(employeeId: string, accountType = "AVAILABLE_BALANCE") {
    if (!this.orgId) return null;

    const { data: existing } = await this.supabase
      .from("financial_accounts")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("account_type", accountType)
      .maybeSingle();

    if (existing) return existing;

    const { data: created } = await this.supabase
      .from("financial_accounts")
      .insert({
        organization_id: this.orgId,
        employee_id: employeeId,
        account_type: accountType,
        currency: "NGN",
        status: "ACTIVE",
      })
      .select()
      .single();

    return created ?? null;
  }

  /**
   * Ensure a savings wallet exists for an external member.
   */
  async ensureMemberFinancialAccount(memberId: string) {
    if (!this.orgId) return null;

    const { data: existing } = await this.supabase
      .from("financial_accounts")
      .select("id")
      .eq("member_id", memberId)
      .eq("account_type", "SAVINGS")
      .maybeSingle();

    if (existing) return existing;

    const { data: created } = await this.supabase
      .from("financial_accounts")
      .insert({
        organization_id: this.orgId,
        member_id: memberId,
        account_type: "SAVINGS",
        currency: "NGN",
        status: "ACTIVE",
      })
      .select()
      .single();

    return created ?? null;
  }

  /**
   * Credit a member's savings wallet and mirror the movement.
   * Debit:  Lending Fund (cash received)   Credit: Member Savings wallet
   */
  async postSavingsDeposit(
    memberId: string,
    reference: string,
    amount: number,
    description = "Savings deposit"
  ) {
    await this.ensureChartOfAccounts();
    const wallet = await this.ensureMemberFinancialAccount(memberId);
    const cash = await this.getAccountByCode("1000");

    if (!wallet?.id) return { error: "Could not open a savings wallet for this member" };

    return this.postTransaction(
      {
        description,
        transactionType: "SAVINGS_DEPOSIT",
        entries: [
          { accountId: cash?.id, debit: amount, credit: 0, description: `${description} - cash received` },
          { financialAccountId: wallet.id, debit: 0, credit: amount, description: `${description} - member savings` },
        ],
      },
      reference
    );
  }

  /**
   * Debit a member's savings wallet (member withdrawal).
   * Debit: Member Savings wallet   Credit: Lending Fund (cash paid out)
   */
  async postSavingsWithdrawal(
    memberId: string,
    reference: string,
    amount: number,
    description = "Savings withdrawal"
  ) {
    await this.ensureChartOfAccounts();
    const wallet = await this.ensureMemberFinancialAccount(memberId);
    const cash = await this.getAccountByCode("1000");

    if (!wallet?.id) return { error: "Savings wallet not found" };

    return this.postTransaction(
      {
        description,
        transactionType: "SAVINGS_WITHDRAWAL",
        entries: [
          { financialAccountId: wallet.id, debit: amount, credit: 0, description: `${description} - member savings` },
          { accountId: cash?.id, debit: 0, credit: amount, description: `${description} - cash paid out` },
        ],
      },
      reference
    );
  }

  /**
   * Salary run credit: the org's salary expense becomes spendable employee
   * balance. Cash has not left the organization yet - it leaves on withdrawal.
   * Debit: Salary Expense   Credit: Employee Balance
   */
  async postSalaryDisbursement(
    employeeId: string,
    runId: string,
    amount: number
  ) {
    await this.ensureChartOfAccounts();
    const wallet = await this.ensureFinancialAccount(employeeId);
    const expense = await this.getAccountByCode("5000");

    if (!wallet?.id) return { error: "Could not open a wallet for this employee" };

    return this.postTransaction(
      {
        description: `Salary disbursement ${runId.slice(0, 8)} - amount ${amount}`,
        transactionType: "SALARY_DISBURSEMENT",
        entries: [
          { accountId: expense?.id, debit: amount, credit: 0, description: "Salary run - expense" },
          { financialAccountId: wallet.id, debit: 0, credit: amount, description: "Salary run - employee wallet" },
        ],
      },
      `SLF-SAL-${runId.slice(0, 8)}-${employeeId.slice(0, 8)}`
    );
  }

  /**
   * Member loan payout: principal receivable against member wallet.
   * Debit: Loan Receivable   Credit: Member Savings wallet
   */
  async postMemberLoanDisbursement(
    memberId: string,
    loanApplicationId: string,
    amount: number
  ) {
    await this.ensureChartOfAccounts();
    const wallet = await this.ensureMemberFinancialAccount(memberId);
    const receivable = await this.getAccountByCode("1100");

    return this.postTransaction(
      {
        description: `Member loan disbursement ${loanApplicationId.slice(0, 8)} - amount ${amount}`,
        transactionType: "LOAN_DISBURSEMENT",
        entries: [
          { accountId: receivable?.id, debit: amount, credit: 0, description: "Member loan - receivable" },
          { financialAccountId: wallet?.id, debit: 0, credit: amount, description: "Member loan - savings wallet" },
        ],
      },
      `SLF-MLOAN-${Date.now()}`
    );
  }

  /**
   * Post a loan disbursement to the ledger.
   * Debit: Loan Receivable         (amount)
   * Credit: Employee Balance       (amount)  -- disbursed funds available to employee
   *
   * The cash itself leaves the lending fund when the employee withdraws, which
   * is where the employee balance is debited against the fund.
   */
  async postLoanDisbursement(
    employeeId: string,
    loanApplicationId: string,
    amount: number
  ) {
    await this.ensureChartOfAccounts();
    const financialAccount = await this.ensureFinancialAccount(employeeId);
    const receivable = await this.getAccountByCode("1100");

    const entries = [
      { accountId: receivable?.id, debit: amount, credit: 0, description: "Loan disbursement - receivable" },
      { financialAccountId: financialAccount?.id, debit: 0, credit: amount, description: "Loan disbursed to employee balance" },
    ].filter((e) => e.accountId || e.financialAccountId);

    return this.postTransaction(
      {
        description: `Loan disbursement ${loanApplicationId.slice(0, 8)} - amount ${amount}`,
        transactionType: "LOAN_DISBURSEMENT",
        entries,
      },
      `SLF-LOAN-${Date.now()}`
    );
  }

  /**
   * Post a withdrawal payout to the ledger.
   * Debit: Employee Balance  (amount)
   * Credit: Lending Fund     (amount)
   */
  async postWithdrawal(
    employeeId: string,
    withdrawalId: string,
    amount: number
  ) {
    await this.ensureChartOfAccounts();
    const financialAccount = await this.ensureFinancialAccount(employeeId);
    const fund = await this.getAccountByCode("1000");

    const entries = [
      { financialAccountId: financialAccount?.id, debit: amount, credit: 0, description: "Withdrawal payout - employee balance" },
      { accountId: fund?.id, debit: 0, credit: amount, description: "Withdrawal payout - lending fund" },
    ].filter((e) => e.accountId || e.financialAccountId);

    return this.postTransaction(
      {
        description: `Withdrawal payout ${withdrawalId.slice(0, 8)} - amount ${amount}`,
        transactionType: "WITHDRAWAL",
        entries,
      },
      `SLF-WDL-${Date.now()}`
    );
  }

  /**
   * Post a loan repayment to the ledger.
   * Debit: Lending Fund      (amount)   -- cash received via salary deduction
   * Credit: Loan Principal   (principal portion)
   * Credit: Interest Income  (interest portion)
   */
  async postLoanRepayment(
    employeeId: string,
    loanApplicationId: string,
    amount: number,
    principalPortion: number,
    interestPortion: number
  ) {
    void employeeId;

    await this.ensureChartOfAccounts();
    const fund = await this.getAccountByCode("1000");
    const principalAccount = await this.getAccountByCode("2000");
    const interestAccount = await this.getAccountByCode("4000");

    const entries = [
      { accountId: fund?.id, debit: amount, credit: 0, description: "Loan repayment - lending fund" },
      { accountId: principalAccount?.id, debit: 0, credit: principalPortion, description: "Loan repayment - principal" },
      { accountId: interestAccount?.id, debit: 0, credit: interestPortion, description: "Loan repayment - interest" },
    ].filter((e) => e.accountId);

    return this.postTransaction(
      {
        description: `Loan repayment ${loanApplicationId.slice(0, 8)} - amount ${amount}`,
        transactionType: "LOAN_REPAYMENT",
        entries,
      },
      `SLF-PAY-${Date.now()}`
    );
  }

  /**
   * Compute the live balance for a financial account from immutable entries.
   * Balance = sum(credits) - sum(debits).
   */
  async getFinancialAccountBalance(financialAccountId: string): Promise<number> {
    if (!this.orgId) return 0;

    const { data } = await this.supabase
      .from("ledger_entries")
      .select("debit, credit")
      .eq("financial_account_id", financialAccountId);

    const totalCredit = (data ?? []).reduce((s, e) => s + (Number(e.credit) || 0), 0);
    const totalDebit = (data ?? []).reduce((s, e) => s + (Number(e.debit) || 0), 0);

    return Math.round((totalCredit - totalDebit) * 100) / 100;
  }

  async getFinancialAccountStatement(financialAccountId: string) {
    if (!this.orgId) return [];

    const { data } = await this.supabase
      .from("ledger_entries")
      .select(
        `
        id,
        debit,
        credit,
        description,
        created_at,
        ledger_transactions!inner(reference, description, transaction_date, status, transaction_type)
      `
      )
      .eq("financial_account_id", financialAccountId)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const tx = row.ledger_transactions as unknown as {
        reference: string;
        description: string;
        transaction_date: string;
        status: string;
        transaction_type: string;
      } | null;
      return {
        id: row.id,
        debit: Number(row.debit),
        credit: Number(row.credit),
        description: row.description ?? tx?.description ?? "",
        reference: tx?.reference ?? "",
        transaction_date: tx?.transaction_date ?? "",
        status: tx?.status ?? "",
        transaction_type: tx?.transaction_type ?? "",
      };
    });
  }
}

