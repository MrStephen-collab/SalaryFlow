import type { Metadata } from "next";
import Link from "next/link";
import { LoanService } from "@/services/loan-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NameSearch } from "@/components/dashboard/name-search";

export const metadata: Metadata = {
  title: "Loan Applications",
};

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
    case "DISBURSED":
      return "default" as const;
    case "COMPLETED":
      return "default" as const;
    case "REJECTED":
    case "DEFAULTED":
      return "destructive" as const;
    case "APPROVED":
    case "READY_FOR_DISBURSEMENT":
      return "default" as const;
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function LoanApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: filterStatus, q } = await searchParams;
  const service = await LoanService.create();
  const applications = await service.listApplications(filterStatus, "EMPLOYEE");

  const term = (q ?? "").trim().toLowerCase();
  const filteredApplications = term
    ? applications.filter((app) =>
        `${app.employeeName ?? ""} ${app.employeeNumber ?? ""}`
          .toLowerCase()
          .includes(term)
      )
    : applications;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and manage employee loan applications
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs defaultValue={filterStatus ?? "all"}>
          <TabsList>
            <TabsTrigger value="all" render={<Link href="/dashboard/loans/applications" />}>
              All
            </TabsTrigger>
            <TabsTrigger value="SUBMITTED" render={<Link href="/dashboard/loans/applications?status=SUBMITTED" />}>
              Submitted
            </TabsTrigger>
            <TabsTrigger value="APPROVED" render={<Link href="/dashboard/loans/applications?status=APPROVED" />}>
              Approved
            </TabsTrigger>
            <TabsTrigger value="ACTIVE" render={<Link href="/dashboard/loans/applications?status=ACTIVE" />}>
              Active
            </TabsTrigger>
            <TabsTrigger value="COMPLETED" render={<Link href="/dashboard/loans/applications?status=COMPLETED" />}>
              Completed
            </TabsTrigger>
            <TabsTrigger value="REJECTED" render={<Link href="/dashboard/loans/applications?status=REJECTED" />}>
              Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <NameSearch placeholder="Search employee name or number…" />
      </div>

      {filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">
              {term ? "No matching applications" : "No applications found"}
            </p>
            <p className="text-sm text-muted-foreground">
              {term
                ? "No employee matches that name or number."
                : filterStatus
                  ? `No applications with status "${filterStatus}"`
                  : "Loan applications will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={8} itemLabel="applications">
              {filteredApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{app.employeeName}</p>
                        {app.borrowerType === "MEMBER" ? (
                          <Badge variant="outline">Member</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {app.employeeNumber}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{app.productName}</TableCell>
                  <TableCell className="text-right text-sm">
                    {naira(app.amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {naira(app.monthly_deduction)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {app.duration_months} mo
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(app.status)}>
                      {app.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {app.submitted_at
                      ? new Date(app.submitted_at).toLocaleDateString("en-NG")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link
                          href={
                            app.borrowerType === "MEMBER"
                              ? "/dashboard/members"
                              : `/dashboard/loans/applications/${app.id}`
                          }
                        />
                      }
                    >
                      {app.borrowerType === "MEMBER" ? "Review" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </CollapsibleTableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
