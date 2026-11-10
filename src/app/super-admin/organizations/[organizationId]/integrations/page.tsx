import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { SuperAdminService } from "@/services/super-admin-service";
import { PlatformIntegrationService } from "@/services/platform-integration-service";
import { OrganizationIntegrationsForm } from "@/components/super-admin/organization-integrations-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plug } from "lucide-react";

export const metadata: Metadata = {
  title: "Organization APIs | SalaryFlow Admin",
};

export default async function OrganizationIntegrationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await requireSuperAdmin();
  const { organizationId } = await params;

  const service = new SuperAdminService();
  const integrationService = await PlatformIntegrationService.create();
  const [organization, rows] = await Promise.all([
    service.getOrganization(organizationId),
    integrationService.listOrganization(organizationId),
  ]);

  if (!organization) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<BackLink href="/super-admin/organizations" />}
          >
            <ArrowLeft className="size-4" />
            Organizations
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {organization.name}
            </h1>
            <Badge variant="outline">
              <Plug className="size-3" />
              Organization APIs
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            SMS, email and payment credentials for this organization. Blank
            values fall back to the platform defaults.
          </p>
        </div>
      </div>

      <OrganizationIntegrationsForm
        organizationId={organization.id}
        organizationName={organization.name}
        rows={rows}
      />
    </div>
  );
}
