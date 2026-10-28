import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  PayrollReconciliationService,
  type ReconciliationStatus,
} from "@/services/payroll-reconciliation-service";
import { SalaryService } from "@/services/salary-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReconciliationUpload } from "@/components/dashboard/deductions/reconciliation-upload";
import { ReconciliationExports } from "@/components/dashboard/deductions/reconciliation-exports";
import { ApplyReconciliationButton } from "@/components/dashboard/deductions/apply-reconciliation-button";

export const metadata: Metadata = {
  title: "Payroll reconciliation",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  MATCHED: "Matched",
  UNDER: "Under-deducted",
  OVER: "Over-deducted",
  MISSING: "Not deducted",
};

function statusVariant(status: ReconciliationStatus) {
  switch (status) {
    case "MATCHED":
      return "default" as const;
    case "UNDER":
    case "MISSING":
      return "destructive" as const;
    case "OVER":
      return "secondary" as const;
  }
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireUser();
  const { period: periodParam } = await searchParams;

  const service = await PayrollReconciliationService.create();
  if (!service.canView()) redirect("/dashboard");

  const salaryService = await SalaryService.create();
  const periods = await salaryService.listPeriods();
  const periodId = periodParam || periods[0]?.id || "";
  const result = periodId
    ? await service.getReconciliation(periodId)
    : null;

  const canManage = service.canManage();
  const summary = result?.summary;
  const rows = result?.rows ?? [];
  const pendingRows = rows.filter(
    (row) => row.actual > 0 && row.pendingDeductionIds.length > 0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Payroll reconciliation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare the payroll report with expected loan deductions, then post
            the result to loans and the ledger.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href="/dashboard/deductions" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {periodId ? (
            <>
              <ReconciliationExports periodId={periodId} />
              {canManage ? <ReconciliationUpload periodId={periodId} /> : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {periods.map((period) => (
          <Button
            key={period.id}
            size="sm"
            variant={periodId === period.id ? "default" : "outline"}
            render={
              <a href={`/dashboard/deductions/reconciliation?period=${period.id}`}>
                {period.name}
              </a>
            }
          />
        ))}
      </div>

      {!periodId ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ClipboardCheck className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No salary periods yet</p>
            <p className="text-sm text-muted-foreground">
              Create a salary period and import salaries before reconciling
              payroll.
            </p>
          </CardContent>
        </Card>
      ) : result?.error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {result.error}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Expected</p>
                <p className="text-2xl font-bold">{naira(summary?.expected ?? 0)}</p>
                <p className="text-xs text-muted-foreground">
                  From generated loan deductions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Actual deducted</p>
                <p className="text-2xl font-bold text-green-600">
                  {naira(summary?.actual ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.hasActuals
                    ? "Uploaded payroll report"
                    : "In-app processed deductions"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Difference</p>
                <p
                  className={`text-2xl font-bold ${
                    (summary?.difference ?? 0) < 0 ? "text-red-600" : ""
                  }`}
                >
                  {naira(summary?.difference ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Actual minus expected
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Exceptions</p>
                <p className="text-2xl font-bold">{summary?.exceptions ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {summary?.under ?? 0} under · {summary?.over ?? 0} over ·{" "}
                  {summary?.missing ?? 0} missing
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
              <div>
                <CardTitle className="text-base">Reconciliation</CardTitle>
                <CardDescription>
                  {summary?.hasActuals
                    ? `${summary.matched} of ${rows.length} employee${
                        rows.length === 1 ? "" : "s"
                      } reconciled.`
                    : "No payroll report uploaded yet — amounts come from deductions already processed in the app."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <ApplyReconciliationButton
                    periodId={periodId}
                    employees={pendingRows.length}
                    total={
                      pendingRows.reduce((sum, row) => sum + row.actual, 0)
                    }
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium">Nothing to reconcile</p>
                  <p className="text-sm text-muted-foreground">
                    Import salaries and generate scheduled deductions for this
                    period first.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead className="text-right">Loan deductions</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {row.employeeName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.employeeNumber || "No employee number"}
                            {row.hasPayrollRecord
                              ? ""
                              : " · no salary record"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {naira(row.expected)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {naira(row.actual)}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm ${
                            row.difference < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {naira(row.difference)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.deductionIds.length}
                          <div className="text-xs text-muted-foreground">
                            {row.pendingDeductionIds.length} pending
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.status)}>
                            {STATUS_LABELS[row.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {rows.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Over-deductions are capped at the amount owed to the lending fund;
              any excess stays on the payroll report. Posting updates schedules,
              repayment records and the ledger in one pass.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
