import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { PlatformIntegrationService } from "@/services/platform-integration-service";
import { IntegrationsForm } from "@/components/super-admin/integrations-form";
import { MaintenanceModeCard } from "@/components/super-admin/maintenance-mode-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Integrations | SalaryFlow Admin",
};

export default async function SuperAdminIntegrationsPage() {
  await requireSuperAdmin();
  const service = await PlatformIntegrationService.create();
  const rows = await service.list();
  const maintenanceMode = await service.getMaintenanceMode();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://salaryflow-two.vercel.app";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide keys for payments, email and SMS. Only the platform
            owner can change them. Organizations can override these on their own
            APIs page.
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link href="/super-admin/organizations" />}
        >
          Manage organization APIs
        </Button>
      </div>

      <MaintenanceModeCard enabled={maintenanceMode} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway endpoints</CardTitle>
          <CardDescription>
            Use these URLs in the Paystack dashboard when configuring callbacks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Webhook URL</p>
            <p className="font-mono text-xs break-all">
              {siteUrl}/api/payments/webhook/paystack
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Callback URL</p>
            <p className="font-mono text-xs break-all">
              {siteUrl}/api/payments/callback
            </p>
          </div>
        </CardContent>
      </Card>

      <IntegrationsForm rows={rows} />
    </div>
  );
}
