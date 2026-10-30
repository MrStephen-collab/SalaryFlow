import type { Metadata } from "next";
import { getOrganization } from "@/lib/auth";
import { SettingsService } from "@/services/settings-service";
import { OrganizationForm } from "@/components/dashboard/settings/organization-form";
import { PolicyForm } from "@/components/dashboard/settings/policy-form";
import { NinVerification } from "@/components/nin/nin-verification";
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
  const service = await SettingsService.create();
  const settings = await service.getSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization profile and policy limits
        </p>
      </div>

      <OrganizationForm organization={organization} />

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