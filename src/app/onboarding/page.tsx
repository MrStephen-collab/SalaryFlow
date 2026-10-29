import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";

export const metadata: Metadata = {
  title: "Get Started | SalaryFlow",
};

export default async function OnboardingPage() {
  const user = await requireUser();

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role === "SUPER_ADMIN") {
    redirect("/super-admin");
  }

  if (profile?.organization_id) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <SalaryFlowLogo size="md" animated className="mb-6" />
      <OnboardingForm />
      <p className="mt-4 max-w-md text-center text-xs text-muted-foreground">
        You will become the organization owner after setting up your
        organization.
      </p>
    </div>
  );
}