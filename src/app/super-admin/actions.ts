"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import {
  subscriptionPlanSchema,
  enrollOrganizationSchema,
} from "@/schemas/super-admin";
import { organizationSchema } from "@/schemas/settings";

export type ActionResult = {
  error?: string;
  success?: string;
};

async function requireSuperAdminAction() {
  const user = await requireUser();
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  return adminClient;
}

export async function createPlan(
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = subscriptionPlanSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const adminClient = await requireSuperAdminAction();
    const { error } = await adminClient.from("subscription_plans").insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      max_employees: parsed.data.max_employees,
      max_branches: parsed.data.max_branches,
      max_active_loans: parsed.data.max_active_loans,
      price_monthly: parsed.data.price_monthly,
      price_annually: parsed.data.price_annually,
      features: [],
      active: true,
    });

    if (error) {
      return { error: "Unable to create plan" };
    }

    revalidatePath("/super-admin/plans");
    return { success: "Plan created" };
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

type UpdatedPlan = {
  id: string;
  name: string;
  description: string | null;
  max_employees: number;
  max_branches: number;
  max_active_loans: number;
  price_monthly: number;
  price_annually: number;
  active: boolean;
};

export async function updatePlan(
  planId: string,
  values: unknown
): Promise<ActionResult & { plan?: UpdatedPlan }> {
  try {
    const parsed = subscriptionPlanSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const adminClient = await requireSuperAdminAction();
    const { data, error } = await adminClient
      .from("subscription_plans")
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        max_employees: parsed.data.max_employees,
        max_branches: parsed.data.max_branches,
        max_active_loans: parsed.data.max_active_loans,
        price_monthly: parsed.data.price_monthly,
        price_annually: parsed.data.price_annually,
      })
      .eq("id", planId)
      .select(
        "id, name, description, max_employees, max_branches, max_active_loans, price_monthly, price_annually, active"
      )
      .single();

    if (error || !data) {
      return { error: "Unable to update plan" };
    }

    revalidatePath("/super-admin/plans");
    return { success: "Plan updated", plan: data as UpdatedPlan };
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

export async function togglePlan(
  planId: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const adminClient = await requireSuperAdminAction();
    const { error } = await adminClient
      .from("subscription_plans")
      .update({ active })
      .eq("id", planId);

    if (error) {
      return { error: "Unable to update plan" };
    }

    revalidatePath("/super-admin/plans");
    return { success: "Plan updated" };
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

export async function updateOrganization(
  organizationId: string,
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = organizationSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const adminClient = await requireSuperAdminAction();
    const { error } = await adminClient
      .from("organizations")
      .update({
        name: parsed.data.name,
        type: parsed.data.type,
        registration_number: parsed.data.registrationNumber || null,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address ?? "",
        state: parsed.data.state ?? "",
        lga: parsed.data.lga ?? "",
        currency: parsed.data.currency,
      })
      .eq("id", organizationId);

    if (error) {
      return { error: "Unable to update organization" };
    }

    revalidatePath("/super-admin/organizations");
    revalidatePath("/super-admin");
    return { success: "Organization updated" };
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

export async function deleteOrganization(
  organizationId: string
): Promise<ActionResult> {
  try {
    const adminClient = await requireSuperAdminAction();
    const { error } = await adminClient
      .from("organizations")
      .delete()
      .eq("id", organizationId);

    if (error) {
      return {
        error:
          "Unable to delete this organization. It may still have linked records.",
      };
    }

    revalidatePath("/super-admin/organizations");
    revalidatePath("/super-admin");
    return { success: "Organization deleted" };
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

export async function enrollOrganization(
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = enrollOrganizationSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue?.path?.map(String).join(".");
      const field = path ? `organization.${path}` : "organization";
      return {
        error: path ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const adminClient = await requireSuperAdminAction();
    const { organization, plan_id, trial_days } = parsed.data;

    if (plan_id) {
      const { data: plan, error: planError } = await adminClient
        .from("subscription_plans")
        .select("id, active")
        .eq("id", plan_id)
        .maybeSingle();

      if (planError || !plan) {
        return { error: "Selected plan does not exist" };
      }
      if (!plan.active) {
        return { error: "Selected plan is not active" };
      }
    }

    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name: organization.name,
        type: organization.type,
        registration_number: organization.registrationNumber || null,
        email: organization.email,
        phone: organization.phone,
        address: organization.address ?? "",
        state: organization.state ?? "",
        lga: organization.lga ?? "",
        currency: organization.currency,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      return { error: "Unable to enroll organization" };
    }

    const { error: settingsError } = await adminClient
      .from("organization_settings")
      .insert({
        organization_id: org.id,
        min_employment_period_months: 0,
        default_interest_method: "FLAT",
        max_tenure: 12,
        guarantor_required: false,
        approval_workflow: "one_level",
        withdrawals_enabled: false,
      });

    if (settingsError) {
      return { error: "Organization created but settings could not be saved" };
    }

    if (plan_id) {
      const now = new Date();
      const trialEnds =
        trial_days > 0 ? new Date(now.getTime() + trial_days * 86400000) : null;
      const periodEnd = new Date(now.getTime() + 30 * 86400000);

      const { error: subscriptionError } = await adminClient
        .from("subscriptions")
        .insert({
          organization_id: org.id,
          plan_id,
          status: "active",
          trial_ends_at: trialEnds?.toISOString() ?? null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });

      if (subscriptionError) {
        return {
          error: "Organization created but subscription could not be assigned",
        };
      }
    }

    revalidatePath("/super-admin/organizations");
    revalidatePath("/super-admin");
    return { success: "Organization enrolled" };
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}