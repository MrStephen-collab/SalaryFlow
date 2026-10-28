import { createClient } from "@/lib/supabase/server";
import type { OrganizationValues } from "@/schemas/settings";

export interface OrganizationSettingsRecord {
  id?: string;
  organization_id: string;
  salary_cycle: string;
  max_salary_deduction_percentage: number;
  min_salary: number;
  min_employment_period_months: number;
  max_loan_amount: number | null;
  default_interest_rate: number | null;
  default_interest_method: string;
  max_tenure: number;
  guarantor_required: boolean;
  approval_workflow: string;
  withdrawals_enabled: boolean;
}

export class SettingsService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;

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

    const service = new SettingsService(supabase);
    service.orgId = orgId;
    return service;
  }

  async getOrganization() {
    if (!this.orgId) return null;

    const { data } = await this.supabase
      .from("organizations")
      .select("*")
      .eq("id", this.orgId)
      .single();

    return data;
  }

  async getSettings() {
    if (!this.orgId) return null;

    const { data } = await this.supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", this.orgId)
      .maybeSingle();

    return data ?? null;
  }

  async updateOrganization(values: OrganizationValues) {
    if (!this.orgId) return { error: "No organization found" };

    const { error } = await this.supabase
      .from("organizations")
      .update({
        name: values.name,
        type: values.type,
        registration_number: values.registrationNumber || null,
        email: values.email,
        phone: values.phone,
        address: values.address ?? "",
        state: values.state ?? "",
        lga: values.lga ?? "",
        currency: values.currency,
      })
      .eq("id", this.orgId);

    if (error) return { error: error.message };
    return { success: "Organization updated" };
  }

  async updateSettings(values: Record<string, unknown>) {
    if (!this.orgId) return { error: "No organization found" };

    const settingsData: Partial<OrganizationSettingsRecord> = {
      organization_id: this.orgId,
      salary_cycle: values.salary_cycle as string,
      max_salary_deduction_percentage: Number(
        values.max_salary_deduction_percentage ?? 30
      ),
      min_salary: Number(values.min_salary ?? 0),
      min_employment_period_months: Number(
        values.min_employment_period_months ?? 0
      ),
      max_loan_amount:
        values.max_loan_amount === undefined ||
        values.max_loan_amount === null ||
        values.max_loan_amount === ""
          ? null
          : Number(values.max_loan_amount),
      default_interest_rate:
        values.default_interest_rate === undefined ||
        values.default_interest_rate === null ||
        values.default_interest_rate === ""
          ? null
          : Number(values.default_interest_rate),
      default_interest_method: values.default_interest_method as string,
      max_tenure: Number(values.max_tenure ?? 12),
      guarantor_required: Boolean(values.guarantor_required),
      approval_workflow: values.approval_workflow as string,
      withdrawals_enabled: Boolean(values.withdrawals_enabled),
    };

    const { error } = await this.supabase
      .from("organization_settings")
      .upsert(settingsData, { onConflict: "organization_id" });

    if (error) return { error: error.message };
    return { success: "Settings updated" };
  }
}