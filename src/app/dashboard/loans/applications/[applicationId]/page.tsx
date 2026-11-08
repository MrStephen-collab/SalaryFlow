import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanService } from "@/services/loan-service";
import { LoanSettlementService } from "@/services/loan-settlement-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { ArrowLeft } from "lucide-react";
import { ApplicationActions } from "@/components/dashboard/loans/application-actions";
import { SettlementActions, RestructureHistoryTable } from "@/components/dashboard/loans/settlement-actions";
import { LoanScheduleActions } from "@/components/loans/loan-schedule-actions";

export const metadata: Metadata = {
  title: "Loan Application",
};

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
    case "DISBURSED":
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

export default async function LoanApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const service = await LoanService.create();
  const application = await service.getApplication(applicationId);

  if (!application) {
    notFound();
  }

  const schedule = await service.getSchedule(applicationId);

  const settlement = await LoanSettlementService.create();
  const canManageSettlements = settlement.canManageSettlements();
  const quoteResult = await settlement.getSettlementQuote(applicationId);
  const restructureHistory = canManageSettlements
    ? await settlement.getRestructureHistory(applicationId)
    : [];

  const totalPaid = schedule.reduce(
    (sum, s) => sum + (Number(s.paid_amount) || 0),
    0
  );
  const totalDue = schedule.reduce(
    (sum, s) => sum + (Number(s.total_payment) || 0),
    0
  );
  const progress = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Loan Application
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {application.employeeName} — {application.productName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {schedule.length > 0 ? (
            <LoanScheduleActions loanId={application.id} />
          ) : null}
          <Button
            variant="outline"
            render={<Link href="/dashboard/loans/applications" />}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <ApplicationActions
            applicationId={application.id}
            status={application.status}
          />
        </div>
      </div>

      {application.member_id ? (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">External member loan</p>
            <p className="mt-1">
              Member loans are approved and disbursed from the Members page so
              the proceeds go to their savings wallet.
            </p>
          </div>
          <Button render={<Link href="/dashboard/members" />}>
            Review on Members page
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Loan Amount</CardDescription>
            <CardTitle className="text-xl">
              {naira(application.amount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Repayment</CardDescription>
            <CardTitle className="text-xl">
              {naira(application.total_repayment)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Repayment</CardDescription>
            <CardTitle className="text-xl">
              {naira(application.monthly_deduction)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle>
              <Badge variant={statusVariant(application.status)}>
                {application.status.replace(/_/g, " ")}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {canManageSettlements && quoteResult.quote && (
        <SettlementActions
          applicationId={application.id}
          quote={quoteResult.quote}
          history={restructureHistory}
        />
      )}

      {canManageSettlements &&
        !quoteResult.quote &&
        restructureHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Restructure history</CardTitle>
              <CardDescription>
                Previous versions of this loan&apos;s repayment plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RestructureHistoryTable history={restructureHistory} />
            </CardContent>
          </Card>
        )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employee Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{application.employeeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee No.</span>
              <span className="font-mono">{application.employeeNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department</span>
              <span className="font-medium">
                {application.employeeDepartment || "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium">{application.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">
                {application.interest_rate}% ({application.interest_method})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">
                {application.duration_months} months
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Interest</span>
              <span className="font-medium">
                {naira(application.total_interest)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-medium">
                {naira(Number(application.processing_fee) || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insurance Fee</span>
              <span className="font-medium">
                {naira(Number(application.insurance_fee) || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Disbursed</span>
              <span className="font-medium">
                {naira(
                  Math.max(
                    0,
                    Number(application.amount) -
                      (Number(application.processing_fee) || 0) -
                      (Number(application.insurance_fee) || 0)
                  )
                )}
              </span>
            </div>
            {application.purpose && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purpose</span>
                <span className="max-w-[200px] text-right font-medium">
                  {application.purpose}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(application.status === "ACTIVE" ||
        application.status === "COMPLETED" ||
        application.status === "DISBURSED") && (
        <Card>
          <CardHeader>
            <CardTitle>Repayment Progress</CardTitle>
            <CardDescription>
              {naira(totalPaid)} paid of {naira(totalDue)} ({progress}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={7} itemLabel="installments">
                  {schedule.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.month_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.due_date
                          ? new Date(entry.due_date).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(entry.principal_payment)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(entry.interest_payment)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {naira(entry.total_payment)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(entry.paid_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.status === "PAID"
                              ? "default"
                              : entry.status === "LATE"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {entry.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
