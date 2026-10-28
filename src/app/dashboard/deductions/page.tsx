import type { Metadata } from "next";
import Link from "next/link";
import { DeductionService } from "@/services/deduction-service";
import { SalaryService } from "@/services/salary-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, FileText } from "lucide-react";
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
import { GenerateDeductionsButton } from "@/components/dashboard/deductions/generate-deductions-button";
import { ProcessDeductionButton } from "@/components/dashboard/deductions/process-deduction-button";

export const metadata: Metadata = {
  title: "Deductions",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusVariant(status: string) {
  switch (status) {
    case "PROCESSED":
      return "default" as const;
    case "PARTIAL":
      return "secondary" as const;
    case "FAILED":
      return "destructive" as const;
    case "WAIVED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodFilter } = await searchParams;
  const service = await DeductionService.create();
  const salaryService = await SalaryService.create();

  const [deductions, periods] = await Promise.all([
    service.listDeductions(periodFilter),
    salaryService.listPeriods(),
  ]);

  const totals = deductions.reduce(
    (acc, d) => {
      acc.expected += Number(d.expected_amount) || 0;
      acc.actual += Number(d.actual_amount) || 0;
      acc.shortfall += Number(d.shortfall) || 0;
      return acc;
    },
    { expected: 0, actual: 0, shortfall: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Deductions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automated loan deductions and payroll reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {periods.map((period) => (
              <Button
                key={period.id}
                size="sm"
                variant={periodFilter === period.id ? "default" : "outline"}
                render={
                  <a href={`/dashboard/deductions?period=${period.id}`}>
                    {period.name}
                  </a>
                }
              />
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/dashboard/deductions/payroll" />}
          >
            <FileText className="size-4" />
            Payroll
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/dashboard/deductions/reconciliation" />}
          >
            <ClipboardCheck className="size-4" />
            Reconcile
          </Button>
          <GenerateDeductionsButton
            periods={periods.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Expected</p>
            <p className="text-lg font-bold">{naira(totals.expected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-lg font-bold text-green-600">
              {naira(totals.actual)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Shortfall</p>
            <p className="text-lg font-bold text-red-600">
              {naira(totals.shortfall)}
            </p>
          </CardContent>
        </Card>
      </div>

      {deductions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No deductions generated</p>
            <p className="text-sm text-muted-foreground">
              Select a salary period and generate scheduled deductions for
              active loans.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={7} itemLabel="deductions">
              {deductions.map((deduction) => (
                <TableRow key={deduction.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{deduction.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {deduction.employeeNumber}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {deduction.periodName}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {naira(deduction.expected_amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {naira(deduction.actual_amount)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm ${
                      deduction.shortfall > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {naira(deduction.shortfall)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(deduction.status)}>
                      {deduction.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {["PROCESSED", "PARTIAL"].includes(deduction.status) &&
                        Number(deduction.actual_amount) > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            render={
                              <Link href={`/receipts/deduction/${deduction.id}`} />
                            }
                          >
                            Receipt
                          </Button>
                        )}
                      <ProcessDeductionButton
                        deductionId={deduction.id}
                        status={deduction.status}
                      />
                    </div>
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