import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { StatementService } from "@/services/statement-service";
import { StatementActions } from "@/components/employee/statement-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/report-export";
import { ArrowDownLeft, ArrowUpRight, FileText, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Statement",
};

function statusVariant(status: string) {
  switch (status) {
    case "PAID":
    case "PROCESSED":
    case "APPROVED":
      return "default" as const;
    case "PARTIAL":
      return "secondary" as const;
    case "FAILED":
    case "REJECTED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export default async function EmployeeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const service = await StatementService.create();
  const statement = await service.getStatement(from, to);

  if (!statement) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statement</h1>
          <p className="text-sm text-muted-foreground">
            Your account activity, payroll and receipts
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No employee profile found</p>
            <p className="text-sm text-muted-foreground">
              Your account is not linked to an employee record yet. Contact
              your HR administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const forwardedProto = headerList.get("x-forwarded-proto");
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (host ? `${forwardedProto ?? "http"}://${host}` : "http://localhost:3000");

  const query = `from=${statement.from}&to=${statement.to}`;
  const downloadHref = `/employee/statement/export?${query}`;
  const shareUrl = `${origin}/employee/statement?${query}`;

  const hasActivity =
    statement.lines.length > 0 ||
    statement.payroll.length > 0 ||
    statement.deductions.length > 0 ||
    statement.withdrawals.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statement</h1>
          <p className="text-sm text-muted-foreground">
            Your account activity, payroll and receipts for the selected period
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            method="GET"
            className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="from" className="text-xs">
                From
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={statement.from}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="to" className="text-xs">
                To
              </Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={statement.to}
                className="w-40"
              />
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>

          <StatementActions downloadHref={downloadHref} shareUrl={shareUrl} />
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Account Statement</h1>
        <p className="text-sm">
          {statement.employee.name}
          {statement.employee.number ? ` · ${statement.employee.number}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {statement.organization.name} · {formatDate(statement.from)} to{" "}
          {formatDate(statement.to)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Opening Balance</p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(statement.openingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Credits</p>
              <ArrowDownLeft className="size-4 text-emerald-600" />
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {formatCurrency(statement.totalCredits)}
            </p>
          </CardContent>
        </Card>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Debits</p>
              <ArrowUpRight className="size-4 text-red-600" />
            </div>
            <p className="mt-1 text-xl font-bold text-red-600">
              {formatCurrency(statement.totalDebits)}
            </p>
          </CardContent>
        </Card>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <Wallet className="size-4 text-primary" />
            </div>
            <p className="mt-1 text-xl font-bold text-primary">
              {formatCurrency(statement.closingBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasActivity && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">Nothing in this period</p>
            <p className="text-sm text-muted-foreground">
              Adjust the date range to see earlier activity.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            Account Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statement.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No balance movements in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(line.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{line.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.type.replace(/_/g, " ")}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {line.reference || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-600">
                      {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">
                      {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(line.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Totals</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.totalCredits)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.closingBalance)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Payroll Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {statement.payroll.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No salary records in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Other Deductions</TableHead>
                  <TableHead className="text-right">Loan Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.payroll.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{record.periodName}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.periodStart
                          ? `${formatDate(record.periodStart)} – ${
                              record.periodEnd
                                ? formatDate(record.periodEnd)
                                : ""
                            }`
                          : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.grossSalary)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-600">
                      {formatCurrency(record.otherDeductions)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-600">
                      {formatCurrency(record.loanDeductions)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.netSalary)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Totals</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.payrollTotals.gross)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.payrollTotals.otherDeductions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.payrollTotals.loanDeductions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.payrollTotals.net)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {statement.deductions.length > 0 && (
        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle>Deduction Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Deducted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.deductions.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.periodName}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.expectedAmount)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.actualAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {record.actualAmount > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link href={`/receipts/deduction/${record.id}`} />
                          }
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {statement.withdrawals.length > 0 && (
        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle>Withdrawal Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.withdrawals.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.bankName || "—"}
                      {record.masked ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {record.masked}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {["PAID", "PROCESSING"].includes(record.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link href={`/receipts/withdrawal/${record.id}`} />
                          }
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
