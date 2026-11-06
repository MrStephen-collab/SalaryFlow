import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface IntegrationRow {
  key: string;
  category: string;
  label: string;
  value: string;
  is_secret: boolean;
  updated_at: string;
}

export const INTEGRATION_KEYS = [
  "payment_provider",
  "paystack_public_key",
  "paystack_secret_key",
  "flutterwave_secret_key",
  "email_provider",
  "email_api_key",
  "email_from",
  "sms_provider",
  "sms_api_key",
  "sms_sender",
] as const;

export class PlatformIntegrationService {
  private constructor(private userId: string | null, private role: string | null) {}

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let role: string | null = null;
    if (user) {
      // Read the role with the service client so RLS cannot hide the platform
      // owner's profile (super admins have no organization membership).
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      role = profile?.role ?? null;
    }

    return new PlatformIntegrationService(user?.id ?? null, role);
  }

  async list(): Promise<IntegrationRow[]> {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_integrations")
      .select("key, category, label, value, is_secret, updated_at")
      .neq("key", "maintenance_mode")
      .order("category", { ascending: true })
      .order("key", { ascending: true });

    return (data ?? []) as IntegrationRow[];
  }

  async getMaintenanceMode(): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from("audit_logs")
      .select("after_data")
      .eq("action", "platform.maintenance_mode")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.after_data || typeof data.after_data !== "object") return false;
    return (data.after_data as { enabled?: boolean }).enabled === true;
  }

  async setMaintenanceMode(enabled: boolean) {
    if (!this.userId) return { ok: false as const, error: "Unauthorized" };
    if (this.role !== "SUPER_ADMIN") {
      return {
        ok: false as const,
        error: "Only the platform owner can change maintenance mode",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(),
      organization_id: null,
      user_id: this.userId,
      action: "platform.maintenance_mode",
      entity_type: "platform",
      entity_id: null,
      before_data: null,
      after_data: { enabled },
      created_at: new Date().toISOString(),
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, enabled };
  }

  async save(values: Record<string, string>) {
    if (!this.userId) return { ok: false as const, error: "Unauthorized" };
    if (this.role !== "SUPER_ADMIN") {
      return { ok: false as const, error: "Only the platform owner can change integrations" };
    }

    const admin = createAdminClient();
    for (const [key, value] of Object.entries(values)) {
      if (!(INTEGRATION_KEYS as readonly string[]).includes(key)) continue;
      const { error } = await admin
        .from("platform_integrations")
        .upsert(
          {
            key,
            value: value ?? "",
            updated_by: this.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      if (error) return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  }
}
