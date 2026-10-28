import type { Metadata } from "next";
import Link from "next/link";
import { LoanService } from "@/services/loan-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;
  const service = await LoanService.create();
  const applications = await service.listApplications(filterStatus);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and manage employee loan applications
          </p>
        </div>
        <Button render={<Link href="/dashboard/loans/apply" />}>
          New Application
        </Button>
      </div>

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

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No applications found</p>
            <p className="text-sm text-muted-foreground">
              {filterStatus
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
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{app.employeeName}</p>
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
                        <Link href={`/dashboard/loans/applications/${app.id}`} />
                      }
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
