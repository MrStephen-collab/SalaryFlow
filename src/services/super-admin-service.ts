import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export class SuperAdminService {
  private admin: AdminClient;

  constructor() {
    this.admin = createAdminClient();
  }

  async getStats() {
    const [orgs, users, employees, activeLoans, subscriptions, plans] =
      await Promise.all([
        this.admin
          .from("organizations")
          .select("id", { count: "exact", head: true }),
        this.admin
          .from("users")
          .select("id", { count: "exact", head: true }),
        this.admin
          .from("employees")
          .select("id", { count: "exact", head: true }),
        this.admin
          .from("loan_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "ACTIVE"),
        this.admin
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        this.admin
          .from("subscription_plans")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
      ]);

    return {
      organizations: orgs.count ?? 0,
      users: users.count ?? 0,
      employees: employees.count ?? 0,
      activeLoans: activeLoans.count ?? 0,
      subscriptions: subscriptions.count ?? 0,
      activePlans: plans.count ?? 0,
    };
  }

  async listOrganizations() {
    const { data, error } = await this.admin
      .from("organizations")
      .select(
        `id, name, type, registration_number, email, phone, address, state, lga, currency, created_at,
         employees(count),
         subscriptions(status, subscription_plans(name))`
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return [];

    return (
      data?.map((org) => ({
        id: org.id as string,
        name: org.name as string,
        type: org.type as string,
        registration_number: (org.registration_number as string | null) ?? null,
        email: org.email as string,
        phone: (org.phone as string | null) ?? null,
        address: (org.address as string | null) ?? null,
        state: (org.state as string | null) ?? null,
        lga: (org.lga as string | null) ?? null,
        currency: org.currency as string,
        created_at: org.created_at as string,
        employeeCount: (org.employees?.[0]?.count as number) ?? 0,
        subscription:
          (org.subscriptions?.[0] as {
            status?: string;
            subscription_plans?: { name?: string } | null;
          } | null) ?? null,
      })) ?? []
    );
  }

  async listPlans() {
    const { data, error } = await this.admin
      .from("subscription_plans")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return [];
    return data ?? [];
  }
}