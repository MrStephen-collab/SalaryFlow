import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const SUBSCRIPTION_MANAGER_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
]);

export interface SubscriptionPlanRecord {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annually: number;
  max_employees: number;
  max_branches: number;
  max_active_loans: number;
  features: unknown;
}

export interface CurrentSubscription {
  id: string;
  status: string;
  planId: string;
  planName: string;
  priceMonthly: number;
  priceAnnually: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

export interface SubscriptionPayment {
  id: string;
  reference: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  planName: string;
  billingCycle: string;
}

export class SubscriptionService {
  private constructor(
    private organizationId: string | null,
    private role: string | null
  ) {}

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let organizationId: string | null = null;
    let role: string | null = null;

    if (user) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      organizationId = profile?.organization_id ?? null;
      role = profile?.role ?? null;
    }

    return new SubscriptionService(organizationId, role);
  }

  hasAccess() {
    return Boolean(
      this.organizationId && this.role && SUBSCRIPTION_MANAGER_ROLES.has(this.role)
    );
  }

  async listPlans(): Promise<SubscriptionPlanRecord[]> {
    const admin = createAdminClient();
    const { data } = await admin
      .from("subscription_plans")
      .select(
        "id, name, description, price_monthly, price_annually, max_employees, max_branches, max_active_loans, features"
      )
      .eq("active", true)
      .order("price_monthly", { ascending: true });
    return (data ?? []) as SubscriptionPlanRecord[];
  }

  async getCurrent(): Promise<CurrentSubscription | null> {
    if (!this.organizationId) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("subscriptions")
      .select(
        `
        id, status, plan_id, current_period_start, current_period_end, trial_ends_at,
        subscription_plans:plan_id(name, price_monthly, price_annually)
      `
      )
      .eq("organization_id", this.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    const plan = data.subscription_plans as unknown as {
      name: string;
      price_monthly: number;
      price_annually: number;
    } | null;

    return {
      id: data.id as string,
      status: data.status as string,
      planId: data.plan_id as string,
      planName: plan?.name ?? "Plan",
      priceMonthly: Number(plan?.price_monthly) || 0,
      priceAnnually: Number(plan?.price_annually) || 0,
      currentPeriodStart: (data.current_period_start as string | null) ?? null,
      currentPeriodEnd: (data.current_period_end as string | null) ?? null,
      trialEndsAt: (data.trial_ends_at as string | null) ?? null,
    };
  }

  async listPayments(limit = 20): Promise<SubscriptionPayment[]> {
    if (!this.organizationId) return [];
    const admin = createAdminClient();
    const { data } = await admin
      .from("payment_transactions")
      .select(
        "id, internal_reference, amount, status, paid_at, created_at, metadata"
      )
      .eq("organization_id", this.organizationId)
      .eq("purpose", "SUBSCRIPTION")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id as string,
        reference: (row.internal_reference as string) ?? "",
        amount: Number(row.amount) || 0,
        status: (row.status as string) ?? "PENDING",
        paidAt: (row.paid_at as string | null) ?? null,
        createdAt: (row.created_at as string) ?? "",
        planName: String(metadata.planName ?? "Subscription"),
        billingCycle: String(metadata.billingCycle ?? "monthly"),
      };
    });
  }
}
