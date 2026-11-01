import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "./audit-service";

export interface Announcement {
  id: string;
  message: string;
  active: boolean;
  created_at: string;
}

const MANAGER_ROLES = new Set(["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN"]);

export class AnnouncementService {
  private constructor(
    private supabase: Awaited<ReturnType<typeof createClient>>,
    private userId: string | null,
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
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      organizationId = profile?.organization_id ?? null;
      role = profile?.role ?? null;
    }

    return new AnnouncementService(
      supabase,
      user?.id ?? null,
      organizationId,
      role
    );
  }

  /** Active announcements for a portal header (no session required). */
  static async listForOrganization(organizationId: string, activeOnly = true) {
    const admin = createAdminClient();
    let query = admin
      .from("announcements")
      .select("id, message, active, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (activeOnly) query = query.eq("active", true);

    const { data } = await query;
    return (data ?? []) as Announcement[];
  }

  async listAll() {
    if (!this.organizationId) return [];
    const admin = createAdminClient();
    const { data } = await admin
      .from("announcements")
      .select("id, message, active, created_at")
      .eq("organization_id", this.organizationId)
      .order("created_at", { ascending: false });
    return (data ?? []) as Announcement[];
  }

  private guard() {
    if (!this.organizationId || !this.userId) return "Unauthorized";
    if (!this.role || !MANAGER_ROLES.has(this.role)) {
      return "Only the chairman or an admin can manage announcements";
    }
    return null;
  }

  async create(message: string) {
    const forbidden = this.guard();
    if (forbidden) return { ok: false as const, error: forbidden };

    const text = message.trim();
    if (!text) return { ok: false as const, error: "Enter an announcement" };

    const admin = createAdminClient();
    const { error } = await admin.from("announcements").insert({
      organization_id: this.organizationId,
      message: text,
      active: true,
      created_by: this.userId,
    });

    if (error) return { ok: false as const, error: error.message };

    await recordAudit({
      organizationId: this.organizationId as string,
      userId: this.userId,
      action: "announcement.created",
      entityType: "announcement",
      after: { message: text },
    });

    return { ok: true as const };
  }

  async update(id: string, values: { message?: string; active?: boolean }) {
    const forbidden = this.guard();
    if (forbidden) return { ok: false as const, error: forbidden };

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (values.message !== undefined) {
      const text = values.message.trim();
      if (!text) return { ok: false as const, error: "Enter an announcement" };
      payload.message = text;
    }
    if (values.active !== undefined) payload.active = values.active;

    const admin = createAdminClient();
    const { error } = await admin
      .from("announcements")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", this.organizationId);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }

  async remove(id: string) {
    const forbidden = this.guard();
    if (forbidden) return { ok: false as const, error: forbidden };

    const admin = createAdminClient();
    const { error } = await admin
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("organization_id", this.organizationId);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }
}
