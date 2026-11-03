import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "./audit-service";

export class FundService {
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

    const service = new FundService(supabase);
    service.orgId = orgId;
    service.userId = user?.id ?? null;
    return service;
  }

  async listFundAccounts() {
    if (!this.orgId) return [];

    const { data } = await this.supabase
      .from("fund_accounts")
      .select("*")
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: true });

    return data ?? [];
  }

  async getFundAccount(fundAccountId: string) {
    if (!this.orgId) return null;

    const { data } = await this.supabase
      .from("fund_accounts")
      .select("*")
      .eq("id", fundAccountId)
      .eq("organization_id", this.orgId)
      .single();

    return data;
  }

  async getOrCreateMemberLoanPool() {
    if (!this.orgId || !this.userId) {
      return { error: "Unauthorized" };
    }

    const { data: existing } = await this.supabase
      .from("fund_accounts")
      .select("id, name")
      .eq("organization_id", this.orgId)
      .eq("status", "ACTIVE")
      .ilike("name", "%member%loan%pool%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return { id: existing.id as string, name: existing.name as string };
    }

    const created = await this.createFundAccount("Member Loan Pool", 0);
    if (created.error || !created.id) {
      return { error: created.error ?? "Could not create the Member Loan Pool" };
    }

    return { id: created.id, name: "Member Loan Pool" };
  }

  async createFundAccount(name: string, openingBalance: number) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: account, error: accountError } = await this.supabase
      .from("fund_accounts")
      .insert({
        organization_id: this.orgId,
        name,
        opening_balance: openingBalance,
      })
      .select()
      .single();

    if (accountError) return { error: accountError.message };

    // Opening balance is stored on the account itself. Do not also post an
    // OPENING movement, otherwise the balance would be counted twice.

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "fund.account_created",
      entityType: "fund_account",
      entityId: account.id,
      after: { name: account.name, openingBalance },
    });

    return { success: "Fund account created", id: account.id };
  }

  async recordMovement(
    fundAccountId: string,
    transactionType: "OPENING" | "FUNDING" | "DISBURSEMENT" | "REPAYMENT" | "WITHDRAWAL" | "ADJUSTMENT",
    amount: number,
    direction: "IN" | "OUT",
    description: string,
    relatedLoanApplicationId?: string
  ) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const reference = `SLF-FND-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { data: movement, error } = await this.supabase
      .from("fund_transactions")
      .insert({
        organization_id: this.orgId,
        fund_account_id: fundAccountId,
        transaction_type: transactionType,
        reference,
        amount,
        direction,
        description,
        related_loan_application_id: relatedLoanApplicationId ?? null,
        created_by: this.userId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "fund.movement",
      entityType: "fund_transaction",
      entityId: movement.id,
      after: {
        fundAccountId,
        transactionType,
        amount,
        direction,
        description,
        relatedLoanApplicationId: relatedLoanApplicationId ?? null,
      },
    });

    return { success: "Movement recorded", reference };
  }

  async fundAccountBalance(fundAccountId: string): Promise<number> {
    if (!this.orgId) return 0;

    const { data: account } = await this.supabase
      .from("fund_accounts")
      .select("opening_balance")
      .eq("id", fundAccountId)
      .eq("organization_id", this.orgId)
      .single();

    const { data: transactions } = await this.supabase
      .from("fund_transactions")
      .select("amount, direction")
      .eq("fund_account_id", fundAccountId);

    let balance = Number(account?.opening_balance) || 0;

    for (const t of transactions ?? []) {
      const amt = Number(t.amount) || 0;
      balance += t.direction === "IN" ? amt : -amt;
    }

    return Math.round(balance * 100) / 100;
  }

  async listFundTransactions(fundAccountId?: string, limit = 100) {
    if (!this.orgId) return [];

    let query = this.supabase
      .from("fund_transactions")
      .select("*")
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fundAccountId) {
      query = query.eq("fund_account_id", fundAccountId);
    }

    const { data } = await query;
    return data ?? [];
  }
}
