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
import { StatCard, type StatAccent } from "@/components/ui/stat-card";
import {
  Building2,
  Users,
  IdCard,
  HandCoins,
  BadgeCheck,
  LayoutList,
} from "lucide-react";
import { SuperAdminService } from "@/services/super-admin-service";
import { requireSuperAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Overview | SalaryFlow Admin",
};

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const service = new SuperAdminService();
  const [stats, organizations] = await Promise.all([
    service.getStats(),
    service.listOrganizations(),
  ]);

  const cards = [
    {
      label: "Organizations",
      value: stats.organizations,
      href: "/super-admin/organizations",
      icon: Building2,
      accent: "blue",
    },
    {
      label: "Total Users",
      value: stats.users,
      href: "/super-admin/organizations",
      icon: Users,
      accent: "slate",
    },
    {
      label: "Employees",
      value: stats.employees,
      href: "/super-admin/organizations",
      icon: IdCard,
      accent: "cyan",
    },
    {
      label: "Active Loans",
      value: stats.activeLoans,
      href: "/super-admin/organizations",
      icon: HandCoins,
      accent: "emerald",
    },
    {
      label: "Active Subscriptions",
      value: stats.subscriptions,
      href: "/super-admin/plans",
      icon: BadgeCheck,
      accent: "amber",
    },
    {
      label: "Active Plans",
      value: stats.activePlans,
      href: "/super-admin/plans",
      icon: LayoutList,
      accent: "violet",
    },
  ] satisfies {
    label: string;
    value: number;
    href: string;
    icon: typeof Building2;
    accent: StatAccent;
  }[];

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          High-level metrics across all organizations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <StatCard
            key={card.label}
            title={card.label}
            value={card.value.toLocaleString()}
            href={card.href}
            icon={card.icon}
            accent={card.accent}
            delay={i * 80}
          />
        ))}
      </div>

      <Card className="animate-fade-up" style={{ animationDelay: "480ms" }}>
        <CardHeader>
          <CardTitle>Recent Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No organizations yet
                  </TableCell>
                </TableRow>
              ) : (
                organizations.slice(0, 10).map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{org.type}</TableCell>
                    <TableCell>{org.employeeCount}</TableCell>
                    <TableCell>
                      {org.subscription?.subscription_plans?.name ?? "No plan"}
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