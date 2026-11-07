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

export interface IntegrationDefinition {
  key: string;
  category: string;
  label: string;
  is_secret: boolean;
}

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    key: "payment_mode",
    category: "payment",
    label: "Payment mode (test / live)",
    is_secret: false,
  },
  {
    key: "payment_provider",
    category: "payment",
    label: "Payment provider (paystack / flutterwave / manual)",
    is_secret: false,
  },
  {
    key: "paystack_public_key_test",
    category: "payment",
    label: "Paystack public key",
    is_secret: false,
  },
  {
    key: "paystack_public_key_live",
    category: "payment",
    label: "Paystack public key",
    is_secret: false,
  },
  {
    key: "paystack_secret_key_test",
    category: "payment",
    label: "Paystack secret key",
    is_secret: true,
  },
  {
    key: "paystack_secret_key_live",
    category: "payment",
    label: "Paystack secret key",
    is_secret: true,
  },
  {
    key: "flutterwave_secret_key_test",
    category: "payment",
    label: "Flutterwave secret key",
    is_secret: true,
  },
  {
    key: "flutterwave_secret_key_live",
    category: "payment",
    label: "Flutterwave secret key",
    is_secret: true,
  },
  {
    key: "email_mode",
    category: "email",
    label: "Email mode (test / live)",
    is_secret: false,
  },
  {
    key: "email_provider",
    category: "email",
    label: "Email provider (resend / smtp)",
    is_secret: false,
  },
  {
    key: "email_from",
    category: "email",
    label: "From address",
    is_secret: false,
  },
  {
    key: "email_api_key_test",
    category: "email",
    label: "Email API key",
    is_secret: true,
  },
  {
    key: "email_api_key_live",
    category: "email",
    label: "Email API key",
    is_secret: true,
  },
  {
    key: "sms_mode",
    category: "sms",
    label: "SMS mode (test / live)",
    is_secret: false,
  },
  {
    key: "sms_provider",
    category: "sms",
    label: "SMS provider (termii / twilio)",
    is_secret: false,
  },
  {
    key: "sms_sender",
    category: "sms",
    label: "SMS sender ID",
    is_secret: false,
  },
  {
    key: "sms_api_key_test",
    category: "sms",
    label: "SMS API key",
    is_secret: true,
  },
  {
    key: "sms_api_key_live",
    category: "sms",
    label: "SMS API key",
    is_secret: true,
  },
];

export const INTEGRATION_KEYS = INTEGRATION_DEFINITIONS.map(
  (definition) => definition.key
);

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
      .select("key, value, updated_at");

    const saved = new Map(
      (data ?? []).map((row) => [
        row.key as string,
        {
          value: (row.value as string | null) ?? "",
          updatedAt: (row.updated_at as string | null) ?? "",
        },
      ])
    );

    return INTEGRATION_DEFINITIONS.map((definition) => {
      const row = saved.get(definition.key);
      return {
        ...definition,
        value: row?.value ?? "",
        updated_at: row?.updatedAt ?? "",
      };
    });
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
    const definitions = new Map(
      INTEGRATION_DEFINITIONS.map((definition) => [definition.key, definition])
    );

    for (const [key, value] of Object.entries(values)) {
      if (!INTEGRATION_KEYS.includes(key)) continue;
      const meta = definitions.get(key);
      if (!meta) continue;

      const { error } = await admin
        .from("platform_integrations")
        .upsert(
          {
            key,
            category: meta.category,
            label: meta.label,
            is_secret: meta.is_secret,
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

  /** Integration fields for one organization with platform defaults as the template. */
  async listOrganization(organizationId: string): Promise<IntegrationRow[]> {
    const admin = createAdminClient();
    const { data: organization } = await admin
      .from("organization_integrations")
      .select("key, value, updated_at")
      .eq("organization_id", organizationId);

    const organizationValues = new Map(
      (organization ?? []).map((row) => [
        row.key as string,
        {
          value: (row.value as string | null) ?? "",
          updatedAt: (row.updated_at as string | null) ?? "",
        },
      ])
    );

    return INTEGRATION_DEFINITIONS.map((definition) => {
      const saved = organizationValues.get(definition.key);
      return {
        ...definition,
        value: saved?.value ?? "",
        updated_at: saved?.updatedAt ?? "",
      };
    });
  }

  /** Save organization-specific overrides. Blank values fall back to platform defaults. */
  async saveOrganization(
    organizationId: string,
    values: Record<string, string>
  ) {
    if (!this.userId) return { ok: false as const, error: "Unauthorized" };
    if (this.role !== "SUPER_ADMIN") {
      return {
        ok: false as const,
        error: "Only the platform owner can change organization integrations",
      };
    }

    const admin = createAdminClient();
    const definitions = new Map(
      INTEGRATION_DEFINITIONS.map((definition) => [definition.key, definition])
    );

    for (const [key, value] of Object.entries(values)) {
      if (!INTEGRATION_KEYS.includes(key)) continue;
      const meta = definitions.get(key);
      if (!meta) continue;

      const { error } = await admin
        .from("organization_integrations")
        .upsert(
          {
            organization_id: organizationId,
            key,
            category: meta.category,
            label: meta.label,
            is_secret: meta.is_secret,
            value: value ?? "",
            updated_by: this.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,key" }
        );
      if (error) return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  }

  /** Number of non-empty organization overrides, used for the owner overview. */
  async countOrganizationOverrides(organizationId: string) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("organization_integrations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("value", "is", null)
      .neq("value", "");
    return count ?? 0;
  }
}
