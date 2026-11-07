import type { Metadata } from "next";
import Link from "next/link";
import { getOrganization, getProfile } from "@/lib/auth";
import { SettingsService } from "@/services/settings-service";
import { SubscriptionService } from "@/services/subscription-service";
import { OrganizationForm } from "@/components/dashboard/settings/organization-form";
import { PolicyForm } from "@/components/dashboard/settings/policy-form";
import { NinVerification } from "@/components/nin/nin-verification";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const organization = await getOrganization();
  const profile = await getProfile();
  const service = await SettingsService.create();
  const settings = await service.getSettings();
  const canManageSubscription =
    profile?.role === "ORGANIZATION_OWNER" ||
    profile?.role === "ORGANIZATION_ADMIN";
  const subscriptionService = await SubscriptionService.create();
  const currentSubscription = canManageSubscription
    ? await subscriptionService.getCurrent()
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization profile and policy limits
        </p>
      </div>

      <OrganizationForm organization={organization} />

      {canManageSubscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
            <CardDescription>
              Choose a plan and pay securely. Only the chairman or an admin can
              manage the organization subscription.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {currentSubscription?.planName ?? "No active plan"}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentSubscription
                  ? `Status: ${currentSubscription.status} · Renews ${
                      currentSubscription.currentPeriodEnd
                        ? new Date(
                            currentSubscription.currentPeriodEnd
                          ).toLocaleDateString("en-GB")
                        : "—"
                    }`
                  : "Select a plan to activate your organization subscription."}
              </p>
            </div>
            <Button
              render={<Link href="/dashboard/settings/subscription" />}
            >
              Manage subscription
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {organization ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Owner NIN Verification</CardTitle>
            <CardDescription>
              Review and verify the organization owner&apos;s National
              Identification Number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NinVerification
              kind="organization"
              id={organization.id}
              nin={organization.nin}
              documentUrl={organization.nin_document_url}
              status={organization.nin_status}
            />
          </CardContent>
        </Card>
      ) : null}

      <PolicyForm settings={settings} />
    </div>
  );
}