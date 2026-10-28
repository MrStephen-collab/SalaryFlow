import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { DeductionService } from "@/services/deduction-service";
import { SalaryService } from "@/services/salary-service";
import { ExportPayrollButton } from "@/components/dashboard/deductions/export-payroll-button";

export const metadata: Metadata = {
  title: "Payroll",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodFilter } = await searchParams;
  const service = await DeductionService.create();
  const salaryService = await SalaryService.create();
  const periods = await salaryService.listPeriods();

  let rows: Awaited<ReturnType<typeof service.previewPayroll>> = [];
  if (periodFilter) {
    rows = await service.previewPayroll(periodFilter);
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += r.grossSalary;
      acc.loan += r.loanDeduction;
      acc.other += r.otherDeduction;
      acc.net += r.netSalary;
      return acc;
    },
    { gross: 0, loan: 0, other: 0, net: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview net salary after loan and other deductions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/dashboard/deductions" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {periodFilter && <ExportPayrollButton periodId={periodFilter} />}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {periods.map((period) => (
          <Button
            key={period.id}
            size="sm"
            variant={periodFilter === period.id ? "default" : "outline"}
            render={
              <a href={`/dashboard/deductions/payroll?period=${period.id}`}>
                {period.name}
              </a>
            }
          />
        ))}
      </div>

      {!periodFilter ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">Select a salary period</p>
            <p className="text-sm text-muted-foreground">
              Choose a period above to preview its payroll.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Gross Salary</p>
                <p className="text-lg font-bold">{naira(totals.gross)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Loan Deductions</p>
                <p className="text-lg font-bold text-red-600">
                  {naira(totals.loan)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Other Deductions</p>
                <p className="text-lg font-bold text-red-600">
                  {naira(totals.other)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Net Payable</p>
                <p className="text-lg font-bold text-primary">
                  {naira(totals.net)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Loan Ded.</TableHead>
                  <TableHead className="text-right">Other Ded.</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody columns={6} itemLabel="employees">
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <p className="text-sm font-medium">No payroll data</p>
                      <p className="text-sm text-muted-foreground">
                        Import salaries or generate deductions for this period.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.employeeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.employeeNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(row.grossSalary)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(row.loanDeduction)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(row.otherDeduction)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {naira(row.netSalary)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "SHORTFALL" ? "destructive" : "secondary"}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </CollapsibleTableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}