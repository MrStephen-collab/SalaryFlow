import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { InviteRegistrationForm } from "@/components/join/invite-registration-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create your account",
};

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { orgId } = await params;
  const { role } = await searchParams;

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();

  if (!organization) {
    notFound();
  }

  const kind = role === "member" ? "member" : "employee";

  const { data: settings } = await admin
    .from("organization_settings")
    .select("employee_registration_enabled, member_registration_enabled")
    .eq("organization_id", orgId)
    .maybeSingle();

  const registrationOpen =
    kind === "member"
      ? settings?.member_registration_enabled ?? true
      : settings?.employee_registration_enabled ?? true;

  if (!registrationOpen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1>
            <SalaryFlowLogo size="md" animated />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {organization.name}
          </p>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Registration is closed</CardTitle>
            <CardDescription>
              This organization is not accepting new{" "}
              {kind === "member" ? "member" : "employee"} registrations through
              this link right now. Please contact your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button render={<Link href="/auth/login" />}>Go to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <h1>
          <SalaryFlowLogo size="md" animated />
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Join {organization.name}
        </p>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">
            {kind === "member"
              ? "Create your member account"
              : "Create your employee account"}
          </CardTitle>
          <CardDescription>
            {kind === "member"
              ? "Save with your organization and borrow against your savings."
              : "Register with your employer and access your salary portal."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteRegistrationForm
            organizationId={organization.id}
            organizationName={organization.name}
            kind={kind}
          />
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Already registered?{" "}
        <Button
          variant="link"
          className="h-auto p-0"
          render={<Link href="/auth/login" />}
        >
          Sign in
        </Button>
      </p>
    </div>
  );
}
