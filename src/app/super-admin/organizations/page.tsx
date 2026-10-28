import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SuperAdminService } from "@/services/super-admin-service";
import { requireSuperAdmin } from "@/lib/auth";
import { EnrollOrganizationForm } from "@/components/super-admin/enroll-organization-form";

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}