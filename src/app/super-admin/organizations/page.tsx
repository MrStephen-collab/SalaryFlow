import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug } from "lucide-react";
import { SuperAdminService } from "@/services/super-admin-service";
import { requireSuperAdmin } from "@/lib/auth";
import { EnrollOrganizationForm } from "@/components/super-admin/enroll-organization-form";
import { EditOrganizationDialog } from "@/components/super-admin/edit-organization-dialog";
import { DeleteOrganizationButton } from "@/components/super-admin/delete-organization-button";

export const metadata: Metadata = {
  title: "Organizations | SalaryFlow Admin",
};

export default async function OrganizationsPage() {
  await requireSuperAdmin();

  const service = new SuperAdminService();
  const [organizations, plans] = await Promise.all([
    service.listOrganizations(),
    service.listPlans(),
  ]);
  const activePlans = plans
    .filter((plan) => plan.active)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      max_employees: plan.max_employees,
    }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All organizations on the platform
        </p>
      </div>

      <EnrollOrganizationForm plans={activePlans} />

      <Card>
        <CardHeader>
          <CardTitle>{organizations.length} organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>APIs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={10} itemLabel="organizations">
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No organizations yet
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{org.type}</TableCell>
                    <TableCell>{org.email}</TableCell>
                    <TableCell>{org.currency}</TableCell>
                    <TableCell>{org.employeeCount}</TableCell>
                    <TableCell>
                      {org.subscription?.subscription_plans?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          org.subscription?.status === "active"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {org.subscription?.status ?? "none"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={org.integrationCount ? "default" : "secondary"}
                      >
                        {org.integrationCount
                          ? `${org.integrationCount} configured`
                          : "Platform defaults"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          render={
                            <Link
                              href={`/super-admin/organizations/${org.id}/integrations`}
                            />
                          }
                        >
                          <Plug className="size-4" />
                          APIs
                        </Button>
                        <EditOrganizationDialog organization={org} />
                        <DeleteOrganizationButton
                          organizationId={org.id}
                          organizationName={org.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </CollapsibleTableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}