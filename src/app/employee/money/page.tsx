import type { Metadata } from "next";
import Link from "next/link";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { ThriftService } from "@/services/thrift-service";
import { ThriftInterestService } from "@/services/thrift-interest-service";
import { ThriftReleaseRequest } from "@/components/employee/thrift-release-request";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  Percent,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Money",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function EmployeeMoneyPage() {
  const service = await EmployeePortalService.create();
  const thriftService = await ThriftService.create();
  const interestService = await ThriftInterestService.create();
  const [
    balance,
    transactions,
    thriftBalance,
    thriftRequests,
    thriftSummary,
    thriftLedger,
    interest,
  ] = await Promise.all([
    service.getAvailableBalance(),
    service.getTransactions(),
    service.getThriftBalance(),
    thriftService.listMyRequests(),
    thriftService.getMySummary(),
    service.getThriftLedger(),
    interestService.getMySummary(),
  ]);
  const pendingThriftRequest = (thriftRequests as Array<{
    amount: number;
    status: string;
    created_at: string;
  }>).find((request) => request.status === "PENDING") ?? null;

  const credits = transactions.reduce((s, t) => s + t.credit, 0);
  const debits = transactions.reduce((s, t) => s + t.debit, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Money</h1>
          {interest?.sample ? <Badge variant="outline">Sample data</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Your available balance and transaction history
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Available Balance
              </p>
              <Wallet className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-primary sm:mt-2 sm:text-2xl">
              {naira(balance)}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Total Credits In
              </p>
              <ArrowDownLeft className="size-3.5 shrink-0 text-green-600 sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-green-600 sm:mt-2 sm:text-2xl">
              {naira(credits)}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Total Deductions
              </p>
              <ArrowUpRight className="size-3.5 shrink-0 text-red-600 sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-red-600 sm:mt-2 sm:text-2xl">
              {naira(debits)}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Thrift Savings
              </p>
              <PiggyBank className="size-3.5 shrink-0 text-amber-600 sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-amber-600 sm:mt-2 sm:text-2xl">
              {naira(thriftBalance)}
            </p>
            <div className="mt-2">
              <ThriftReleaseRequest
                balance={thriftBalance}
                pending={
                  pendingThriftRequest
                    ? {
                        amount: Number(pendingThriftRequest.amount) || 0,
                        createdAt: pendingThriftRequest.created_at,
                      }
                    : null
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="size-4 text-emerald-600" />
              Thrift Interest Growth
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Interest is calculated monthly on your opening thrift balance at{" "}
              {interest?.annualRate ?? 5}% per annum.
            </p>
          </div>
          {interest?.sample ? <Badge variant="outline">Sample data</Badge> : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Interest this year</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">
              {naira(interest?.ytdInterest ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              Projected for {interest?.currentMonthLabel ?? "this month"}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {naira(interest?.currentProjection ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Lifetime interest</p>
            <p className="mt-1 text-lg font-semibold">
              {naira(interest?.lifetimeInterest ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Last posted</p>
            <p className="mt-1 text-lg font-semibold">
              {interest?.lastAccrual
                ? naira(interest.lastAccrual.interest)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {interest?.lastAccrual?.periodLabel ?? "No interest posted yet"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thrift Savings Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {thriftLedger.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No thrift savings activity</p>
              <p className="text-sm text-muted-foreground">
                Contributions, interest and loan settlements will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {thriftLedger.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {entry.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(
                        `${entry.transaction_date}T00:00:00Z`
                      ).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}{" "}
                      · {entry.reference}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          entry.credit > 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {entry.credit > 0 ? "+" : "−"}
                        {naira(entry.credit > 0 ? entry.credit : entry.debit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance {naira(entry.balance)}
                      </p>
                    </div>
                    {entry.transaction_type === "THRIFT_INTEREST" ? (
                      <Badge variant="secondary">Interest</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Movements on your balance will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between gap-4 py-3 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tx.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.transactionDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {tx.reference}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.status === "REVERSED" && (
                      <Badge variant="outline">REVERSED</Badge>
                    )}
                    <span
                      className={`text-sm font-semibold ${
                        tx.credit > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.credit > 0 ? "+" : "-"}
                      {naira(tx.credit > 0 ? tx.credit : tx.debit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thrift Funding History</CardTitle>
        </CardHeader>
        <CardContent>
          {!thriftSummary || thriftSummary.fundings.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No thrift funding yet</p>
              <p className="text-sm text-muted-foreground">
                Each monthly contribution from your employer will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {thriftSummary.fundings.map((funding, index) => (
                <div
                  key={funding.id}
                  className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{funding.periodLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {funding.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      +{naira(funding.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Loan {naira(funding.loanRepayment)} · Savings{" "}
                      {naira(funding.thriftCredit)}
                    </p>
                    <Link
                      href={`/receipts/thrift/${funding.id}`}
                      className="text-xs font-medium text-primary underline underline-offset-2"
                    >
                      Receipt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}