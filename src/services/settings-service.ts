import { createClient } from "@/lib/supabase/server";
import type { OrganizationValues } from "@/schemas/settings";
import { recordAudit } from "./audit-service";

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
  salary_payment_day?: number | null;
  auto_disburse_salaries?: boolean;
  savings_min_membership_months?: number;
  member_loan_multiplier?: number;
  member_savings_withdrawals_enabled?: boolean;
  employee_registration_enabled?: boolean;
  member_registration_enabled?: boolean;
}

export class SettingsService {
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

    const service = new SettingsService(supabase);
    service.orgId = orgId;
    service.userId = user?.id ?? null;
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

  /** Switch the public employee/member registration link on or off. */
  async setRegistrationLinkEnabled(
    kind: "employee" | "member",
    enabled: boolean
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.orgId || !this.userId) {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", this.userId)
      .maybeSingle();

    if (
      !profile ||
      !["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN"].includes(profile.role)
    ) {
      return { ok: false, error: "You do not have permission to change this" };
    }

    const column =
      kind === "employee"
        ? "employee_registration_enabled"
        : "member_registration_enabled";

    const { error } = await this.supabase
      .from("organization_settings")
      .update({ [column]: enabled })
      .eq("organization_id", this.orgId);

    if (error) return { ok: false, error: error.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "settings.registration_link_toggled",
      entityType: "organization_settings",
      entityId: this.orgId,
      after: { kind, enabled },
    });

    return { ok: true };
  }

  async updateOrganization(values: OrganizationValues) {
    if (!this.orgId) return { error: "No organization found" };

    const { data: before } = await this.supabase
      .from("organizations")
      .select("name, type, email, phone, address, state, currency")
      .eq("id", this.orgId)
      .maybeSingle();

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
        nin: values.nin || null,
        nin_document_url: values.ninDocumentUrl || null,
        currency: values.currency,
      })
      .eq("id", this.orgId);

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "organization.updated",
      entityType: "organization",
      entityId: this.orgId,
      before,
      after: {
        name: values.name,
        type: values.type,
        email: values.email,
        phone: values.phone,
        address: values.address ?? "",
        state: values.state ?? "",
        currency: values.currency,
      },
    });

    return { success: "Organization updated" };
  }

  async updateSettings(values: Record<string, unknown>) {
    if (!this.orgId) return { error: "No organization found" };
    if (!this.userId) return { error: "Unauthorized" };

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", this.userId)
      .maybeSingle();

    if (
      !profile ||
      !["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN"].includes(profile.role)
    ) {
      return {
        error: "Only an admin or the chairman can change the loan policy",
      };
    }

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
      salary_payment_day:
        values.salary_payment_day === undefined ||
        values.salary_payment_day === null ||
        values.salary_payment_day === ""
          ? null
          : Number(values.salary_payment_day),
      auto_disburse_salaries: Boolean(values.auto_disburse_salaries),
      savings_min_membership_months: Number(
        values.savings_min_membership_months ?? 6
      ),
      member_loan_multiplier: Number(values.member_loan_multiplier ?? 2),
      member_savings_withdrawals_enabled:
        values.member_savings_withdrawals_enabled === undefined
          ? true
          : Boolean(values.member_savings_withdrawals_enabled),
    };

    // The money-platform columns only exist after the companion migration has
    // been applied. Fall back to the legacy column set so settings keep saving
    // on deployments that have not run it yet.
    const moneyPlatformColumns = [
      "salary_payment_day",
      "auto_disburse_salaries",
      "savings_min_membership_months",
      "member_loan_multiplier",
      "member_savings_withdrawals_enabled",
    ];

    let { error } = await this.supabase
      .from("organization_settings")
      .upsert(settingsData, { onConflict: "organization_id" });

    if (error && /column|schema cache/i.test(error.message)) {
      const fallback = { ...settingsData };
      for (const column of moneyPlatformColumns) {
        delete fallback[column as keyof typeof fallback];
      }
      ({ error } = await this.supabase
        .from("organization_settings")
        .upsert(fallback, { onConflict: "organization_id" }));
    }

    if (error) return { error: error.message };

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "settings.updated",
      entityType: "settings",
      entityId: this.orgId,
      after: {
        salaryCycle: settingsData.salary_cycle,
        maxSalaryDeductionPercentage:
          settingsData.max_salary_deduction_percentage,
        maxLoanAmount: settingsData.max_loan_amount,
        defaultInterestRate: settingsData.default_interest_rate,
        defaultInterestMethod: settingsData.default_interest_method,
        maxTenure: settingsData.max_tenure,
        guarantorRequired: settingsData.guarantor_required,
        approvalWorkflow: settingsData.approval_workflow,
        withdrawalsEnabled: settingsData.withdrawals_enabled,
      },
    });

    return { success: "Settings updated" };
  }
}