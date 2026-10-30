"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/schemas/onboarding";

export type OnboardingActionResult = {
  error?: string;
  success?: string;
};

export async function completeOnboarding(
  values: unknown
): Promise<OnboardingActionResult> {
  try {
    const parsed = onboardingSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const fieldPath = firstIssue?.path?.map(String).join(".");
      const field = fieldPath ?? "";
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Please sign in to continue" };
    }

    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.organization_id) {
      redirect("/dashboard");
    }

    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name: parsed.data.organization.name,
        type: parsed.data.organization.type,
        registration_number:
          parsed.data.organization.registrationNumber || null,
        email: parsed.data.organization.email,
        phone: parsed.data.organization.phone,
        address: parsed.data.organization.address ?? "",
        state: parsed.data.organization.state ?? "",
        lga: parsed.data.organization.lga ?? "",
        nin: parsed.data.organization.nin || null,
        nin_document_url: parsed.data.organization.ninDocumentUrl || null,
        currency: parsed.data.organization.currency,
      })
      .select("id")
      .single();

    if (orgError || !organization) {
      return { error: "Unable to create your organization" };
    }

    const { error: settingsError } = await adminClient
      .from("organization_settings")
      .insert({
        organization_id: organization.id,
        salary_cycle: parsed.data.settings.salary_cycle,
        max_salary_deduction_percentage:
          parsed.data.settings.max_salary_deduction_percentage,
        min_salary: parsed.data.settings.min_salary,
        min_employment_period_months:
          parsed.data.settings.min_employment_period_months,
        max_loan_amount: parsed.data.settings.max_loan_amount ?? null,
        default_interest_rate: parsed.data.settings.default_interest_rate ?? null,
        default_interest_method: parsed.data.settings.default_interest_method,
        max_tenure: parsed.data.settings.max_tenure,
        guarantor_required: parsed.data.settings.guarantor_required,
        approval_workflow: parsed.data.settings.approval_workflow,
        withdrawals_enabled: parsed.data.settings.withdrawals_enabled,
      });

    if (settingsError) {
      return { error: "Organization created but settings could not be saved" };
    }

    const { error: profileError } = await adminClient
      .from("user_profiles")
      .update({
        organization_id: organization.id,
        role: "ORGANIZATION_OWNER",
      })
      .eq("user_id", user.id);

    if (profileError) {
      return { error: "Organization created but your profile could not be linked" };
    }

    redirect("/dashboard");
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}