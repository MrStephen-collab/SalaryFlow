import Link from "next/link";
import type { StatementData } from "@/services/statement-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { formatCurrency, formatDate } from "@/lib/report-export";
import { ArrowDownLeft, ArrowUpRight, FileText, Percent, Wallet } from "lucide-react";

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

export function StatementDocument({
  statement,
  printHeaderOnly = false,
  expandAll = false,
}: {
  statement: StatementData;
  /** Hide the document heading on screen and show it only when printing. */
  printHeaderOnly?: boolean;
  /** Render every table row instead of collapsing long tables. */
  expandAll?: boolean;
}) {
  const rowLimit = expandAll ? 100_000 : 10;
  const hasActivity =
    statement.lines.length > 0 ||
    statement.thriftFundings.length > 0 ||
    statement.thriftInterest.length > 0 ||
    statement.repayments.length > 0 ||
    statement.withdrawals.length > 0;

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <div className={printHeaderOnly ? "hidden print:block" : ""}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">Account Statement</h1>
          {statement.sample ? <Badge variant="outline">Sample data</Badge> : null}
        </div>
        <p className="text-sm">
          {statement.employee.name}
          {statement.employee.number ? ` · ${statement.employee.number}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {statement.organization.name} · {formatDate(statement.from)} to{" "}
          {formatDate(statement.to)}
        </p>
        {statement.sample ? (
          <p className="mt-1 text-xs text-amber-600">
            This statement uses demonstration data. It is not a real savings or
            payment record.
          </p>
        ) : null}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              Thrift Opening Balance
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(statement.thrift.openingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              Thrift Contributions
            </p>
            <p className="mt-1 text-xl font-bold text-amber-600">
              {formatCurrency(statement.thrift.contributions)}
            </p>
          </CardContent>
        </Card>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Interest Earned</p>
              <Percent className="size-4 text-emerald-600" />
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {formatCurrency(statement.thrift.interestEarned)}
            </p>
            <p className="text-xs text-muted-foreground">
              {statement.thrift.annualRate}% per annum
            </p>
          </CardContent>
        </Card>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              Thrift Closing Balance
            </p>
            <p className="mt-1 text-xl font-bold text-primary">
              {formatCurrency(statement.thrift.closingBalance)}
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
              <CollapsibleTableBody
                columns={6}
                itemLabel="transactions"
                limit={rowLimit}
              >
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
              </CollapsibleTableBody>
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
          <CardTitle>Thrift Savings Interest</CardTitle>
        </CardHeader>
        <CardContent>
          {statement.thriftInterest.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No interest posted in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Contribution</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody
                columns={7}
                itemLabel="months"
                limit={rowLimit}
              >
                {statement.thriftInterest.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{record.periodLabel}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {record.reference || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.openingBalance)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.contributions)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {record.annualRate}%
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {record.eligibleDays}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-emerald-600">
                      {formatCurrency(record.interest)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.closingBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleTableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total interest</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.thrift.interestEarned)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.thrift.closingBalance)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Thrift Funding Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {statement.thriftFundings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No thrift funding in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Funded</TableHead>
                  <TableHead className="text-right">To Loan</TableHead>
                  <TableHead className="text-right">To Savings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody
                columns={6}
                itemLabel="fundings"
                limit={rowLimit}
              >
                {statement.thriftFundings.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{record.periodLabel}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {record.reference || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.loanRepayment)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-amber-600">
                      {formatCurrency(record.thriftCredit)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="print:hidden"
                        render={<Link href={`/receipts/thrift/${record.id}`} />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleTableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Totals</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.thriftTotals.funded)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.thriftTotals.loanRepayment)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(statement.thriftTotals.savings)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {statement.repayments.length > 0 && (
        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle>Loan Repayments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody
                columns={5}
                itemLabel="repayments"
                limit={rowLimit}
              >
                {statement.repayments.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.productName}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {record.paymentMethod.replace(/_/g, " ").toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="print:hidden"
                        render={<Link href={`/receipts/repayment/${record.id}`} />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleTableBody>
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
              <CollapsibleTableBody
                columns={5}
                itemLabel="withdrawals"
                limit={rowLimit}
              >
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
                          className="print:hidden"
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
              </CollapsibleTableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
