import type { Metadata } from "next";
import Link from "next/link";
import { LoanService } from "@/services/loan-service";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NameSearch } from "@/components/dashboard/name-search";

export const metadata: Metadata = {
  title: "Repayments",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function scheduleStatusVariant(status: string) {
  switch (status) {
    case "PAID":
      return "default" as const;
    case "LATE":
      return "destructive" as const;
    case "DUE":
      return "secondary" as const;
    case "WAIVED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

const paymentMethods = ["THRIFT_FUNDING", "BANK_TRANSFER", "CASH", "CARD"];

export default async function RepaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; q?: string }>;
}) {
  const { method, q } = await searchParams;
  const service = await LoanService.create();

  const [repayments, schedules] = await Promise.all([
    service.listRepayments(method),
    service.listOutstandingSchedules(),
  ]);

  const term = (q ?? "").trim().toLowerCase();
  const matches = (name?: string | null, number?: string | null) =>
    !term ||
    `${name ?? ""} ${number ?? ""}`.toLowerCase().includes(term);

  const filteredRepayments = repayments.filter((repayment) =>
    matches(repayment.employeeName, repayment.employeeNumber)
  );
  const filteredSchedules = schedules.filter((schedule) =>
    matches(schedule.employeeName, schedule.employeeNumber)
  );

  const now = new Date();
  const totals = repayments.reduce(
    (acc, r) => {
      acc.total += Number(r.amount) || 0;
      const recorded = new Date(r.recorded_at);
      if (
        recorded.getFullYear() === now.getFullYear() &&
        recorded.getMonth() === now.getMonth()
      ) {
        acc.month += Number(r.amount) || 0;
      }
      return acc;
    },
    { total: 0, month: 0 }
  );

  const outstanding = schedules
    .filter((s) => s.status !== "PAID" && s.status !== "WAIVED")
    .reduce(
      (acc, s) => {
        const remaining = Math.max(
          (Number(s.total_payment) || 0) - (Number(s.paid_amount) || 0),
          0
        );
        acc.balance += remaining;
        if (s.status === "DUE" || s.status === "LATE") {
          acc.overdue += remaining;
          acc.overdueCount += 1;
        }
        return acc;
      },
      { balance: 0, overdue: 0, overdueCount: 0 }
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Repayments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track loan repayments and outstanding installments
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs defaultValue={method ?? "all"}>
          <TabsList>
            <TabsTrigger value="all" render={<Link href="/dashboard/repayments" />}>
              All
            </TabsTrigger>
            {paymentMethods.map((m) => (
              <TabsTrigger
                key={m}
                value={m}
                render={
                  <Link href={`/dashboard/repayments?method=${m}`} />
                }
              >
                {m.replace("_", " ")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <NameSearch placeholder="Search employee name or number…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-lg font-bold">{naira(totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Collected This Month</p>
            <p className="text-lg font-bold">{naira(totals.month)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            <p className="text-lg font-bold">{naira(outstanding.balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Overdue Installments</p>
            <p className="text-lg font-bold text-red-600">
              {outstanding.overdueCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {naira(outstanding.overdue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Repayment Records
        </h2>
        {filteredRepayments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium">
                {term ? "No matching repayments" : "No repayments recorded"}
              </p>
              <p className="text-sm text-muted-foreground">
                {term
                  ? "No employee matches that name or number."
                  : "Repayments are recorded automatically from monthly thrift funding, or manually when a payment is received."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody columns={7} itemLabel="repayments">
                {filteredRepayments.map((repayment) => (
                  <TableRow key={repayment.id}>
                    <TableCell className="text-sm">
                      {new Date(repayment.recorded_at).toLocaleDateString("en-NG")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{repayment.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {repayment.employeeNumber}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {repayment.productName}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {naira(Number(repayment.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {repayment.notes?.startsWith("Early settlement")
                          ? "Early settlement"
                          : repayment.payment_method.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {repayment.reference_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={
                            <Link
                              href={`/dashboard/loans/applications/${repayment.loan_application_id}`}
                            />
                          }
                        >
                          View Loan
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          render={
                            <Link
                              href={`/receipts/repayment/${repayment.id}`}
                            />
                          }
                        >
                          Receipt
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleTableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Outstanding Installments
        </h2>
        {filteredSchedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium">
                {term ? "No matching installments" : "No outstanding installments"}
              </p>
              <p className="text-sm text-muted-foreground">
                {term
                  ? "No employee matches that name or number."
                  : "All active loan installments are up to date."}
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
                  <TableHead className="text-center">Installment</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody columns={7} itemLabel="installments">
                {filteredSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{schedule.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.employeeNumber}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {schedule.productName}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      #{schedule.month_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {schedule.due_date
                        ? new Date(schedule.due_date).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {naira(Number(schedule.total_payment))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {naira(Number(schedule.paid_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={scheduleStatusVariant(schedule.status)}>
                        {schedule.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleTableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}