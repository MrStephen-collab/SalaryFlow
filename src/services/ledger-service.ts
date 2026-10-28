import { createClient } from "@/lib/supabase/server";

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
   * Post a loan disbursement to the ledger.
   * Debit: Loan Receivable         (amount)
   * Credit: Lending Fund           (amount)
   * Credit: Employee Balance       (amount)  -- disbursed funds available to employee
   */
  async postLoanDisbursement(
    employeeId: string,
    loanApplicationId: string,
    amount: number
  ) {
    await this.ensureChartOfAccounts();
    const financialAccount = await this.ensureFinancialAccount(employeeId);
    const receivable = await this.getAccountByCode("1100");
    const fund = await this.getAccountByCode("1000");

    const entries = [
      { accountId: receivable?.id, debit: amount, credit: 0, description: "Loan disbursement - receivable" },
      { accountId: fund?.id, debit: 0, credit: amount, description: "Loan disbursement - lending fund" },
      { financialAccountId: financialAccount?.id, debit: 0, credit: amount, description: "Loan disbursed to employee balance" },
    ].filter((e) => e.accountId || e.financialAccountId);

    return this.postTransaction(
      {
        description: `Loan disbursement - amount ${amount}`,
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
   * Debit: Lending Fund      (amount)
   * Credit: Loan Principal   (principal portion)
   * Credit: Interest Income  (interest portion)
   * Debit: Employee Balance  (amount)  -- deduction from employee balance
   */
  async postLoanRepayment(
    employeeId: string,
    loanApplicationId: string,
    amount: number,
    principalPortion: number,
    interestPortion: number
  ) {
    await this.ensureChartOfAccounts();
    const financialAccount = await this.ensureFinancialAccount(employeeId);
    const fund = await this.getAccountByCode("1000");
    const principalAccount = await this.getAccountByCode("2000");
    const interestAccount = await this.getAccountByCode("4000");

    const entries = [
      { accountId: fund?.id, debit: amount, credit: 0, description: "Loan repayment - lending fund" },
      { accountId: principalAccount?.id, debit: 0, credit: principalPortion, description: "Loan repayment - principal" },
      { accountId: interestAccount?.id, debit: 0, credit: interestPortion, description: "Loan repayment - interest" },
      { financialAccountId: financialAccount?.id, debit: amount, credit: 0, description: "Loan repayment deduction - employee balance" },
    ].filter((e) => e.accountId || e.financialAccountId);

    return this.postTransaction(
      {
        description: `Loan repayment - amount ${amount}`,
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

