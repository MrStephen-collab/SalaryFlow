import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SalaryService } from "@/services/salary-service";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Download, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Salary Records",
};

function statusVariant(status: string) {
  switch (status) {
    case "PAID":
      return "default" as const;
    case "APPROVED":
      return "default" as const;
    case "PROCESSING":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function SalaryPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  const service = await SalaryService.create();
  const period = await service.getPeriod(periodId);

  if (!period) {
    notFound();
  }

  const records = await service.getSalaryRecords(periodId);

  const totals = records.reduce(
    (acc, r) => {
      acc.basic += r.basic_salary;
      acc.allowances += r.allowances;
      acc.gross += r.gross_salary;
      acc.other += r.other_deductions;
      acc.loan += r.loan_deductions;
      acc.net += r.net_salary;
      return acc;
    },
    { basic: 0, allowances: 0, gross: 0, other: 0, loan: 0, net: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{period.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {period.start_date} to {period.end_date} · Paid {period.payment_date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/dashboard/salary" />}>
            Back
          </Button>
          <Button
            variant="outline"
            render={
              <a href={`/dashboard/salary/${periodId}/records.csv`}>
                <Download className="size-4" />
                Export CSV
              </a>
            }
          />
          <Button variant="outline" render={<Link href="/dashboard/salary/import" />}>
            <FileText className="size-4" />
            Import
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross Salary</CardDescription>
            <CardTitle className="text-xl">{naira(totals.gross)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Loan Deductions</CardDescription>
            <CardTitle className="text-xl">{naira(totals.loan)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Other Deductions</CardDescription>
            <CardTitle className="text-xl">{naira(totals.other)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardDescription>Net Payable</CardDescription>
            <CardTitle className="text-2xl text-primary">{naira(totals.net)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>No.</TableHead>
              <TableHead>Basic</TableHead>
              <TableHead>Allowances</TableHead>
              <TableHead>Loan Ded.</TableHead>
              <TableHead>Other Ded.</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <p className="text-sm font-medium">No salary records yet</p>
                  <p className="text-sm text-muted-foreground">
                    Import salaries for this period to get started.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.employee_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.employee_number}
                  </TableCell>
                  <TableCell>{naira(record.basic_salary)}</TableCell>
                  <TableCell>{naira(record.allowances)}</TableCell>
                  <TableCell>{naira(record.loan_deductions)}</TableCell>
                  <TableCell>{naira(record.other_deductions)}</TableCell>
                  <TableCell className="font-medium">
                    {naira(record.net_salary)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(record.status)}>
                      {record.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
