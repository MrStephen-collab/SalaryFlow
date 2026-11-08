import type { Metadata } from "next";
import Link from "next/link";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { ThriftService } from "@/services/thrift-service";
import { ThriftInterestService } from "@/services/thrift-interest-service";
import { ThriftReleaseRequest } from "@/components/employee/thrift-release-request";
import { CollapsibleList } from "@/components/ui/collapsible-list";
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
    activeLoan,
  ] = await Promise.all([
    service.getAvailableBalance(),
    service.getTransactions(),
    service.getThriftBalance(),
    thriftService.listMyRequests(),
    thriftService.getMySummary(),
    service.getThriftLedger(),
    interestService.getMySummary(),
    service.getActiveLoan(),
  ]);
  const pendingThriftRequest = (thriftRequests as Array<{
    amount: number;
    status: string;
    created_at: string;
  }>).find((request) => request.status === "PENDING") ?? null;

  const credits = transactions.reduce((s, t) => s + t.credit, 0);
  const debits = transactions.reduce((s, t) => s + t.debit, 0);
  const interestByMonth = new Map(
    (interest?.months ?? []).map((month) => [month.periodMonth, month.interest])
  );
  const fundingTotals = (thriftSummary?.fundings ?? []).reduce(
    (totals, funding) => ({
      funded: totals.funded + funding.amount,
      toLoan: totals.toLoan + funding.loanRepayment,
      toSavings: totals.toSavings + funding.thriftCredit,
      interest:
        totals.interest + (interestByMonth.get(funding.periodMonth) ?? 0),
    }),
    { funded: 0, toLoan: 0, toSavings: 0, interest: 0 }
  );

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
                hasActiveLoan={Boolean(activeLoan)}
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
              Interest grows daily on your opening thrift balance at{" "}
              {interest?.annualRate ?? 5}% per annum. The projected amount is
              the sum of every day&apos;s growth for the month.
            </p>
          </div>
          {interest?.sample ? <Badge variant="outline">Sample data</Badge> : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Thrift Interest Sum</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">
              {naira(interest?.ytdInterest ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              Projected Thrift Interest
            </p>
            <p className="mt-1 text-lg font-semibold">
              {naira(interest?.currentProjection ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {interest?.currentMonthLabel ?? "This month"} month-end
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Lifetime interest</p>
            <p className="mt-1 text-lg font-semibold">
              {naira(interest?.lifetimeInterest ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              Daily Interest Growth
            </p>
            <p className="mt-1 text-lg font-semibold">
              {naira(interest?.dailyGrowthToDate ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Today +{naira(interest?.dailyGrowth ?? 0)} · Day{" "}
              {interest?.dayOfMonth ?? 0} of {interest?.daysInMonth ?? 0}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thrift Interest Payment History</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every month&apos;s interest credited to your thrift savings account.
          </p>
        </CardHeader>
        <CardContent>
          {!interest || interest.months.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No interest posted yet</p>
              <p className="text-sm text-muted-foreground">
                Interest starts after your first completed month of thrift
                savings.
              </p>
            </div>
          ) : (
            <CollapsibleList className="flex flex-col" itemLabel="months">
              {interest.months.map((month, index) => (
                <div
                  key={month.id}
                  className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{month.periodLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {month.eligibleDays} days · {month.annualRate}% p.a. ·
                      Opening {naira(month.openingBalance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      +{naira(month.interest)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Closing {naira(month.closingBalance)}
                    </p>
                  </div>
                </div>
              ))}
            </CollapsibleList>
          )}
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
            <CollapsibleList className="flex flex-col" itemLabel="entries">
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
            </CollapsibleList>
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
            <CollapsibleList className="flex flex-col" itemLabel="transactions">
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
            </CollapsibleList>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Thrift Funding &amp; Repayment History</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every month shows the thrift funding paid in and the deduction taken
            out of that thrift to repay your active loan.
          </p>
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
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Funding In</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">
                    +{naira(fundingTotals.funded)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Loan Repayment Out
                  </p>
                  <p className="mt-1 text-sm font-semibold text-red-600">
                    −{naira(fundingTotals.toLoan)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Interest In</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">
                    +{naira(fundingTotals.interest)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Net Savings In
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-600">
                    +{naira(fundingTotals.toSavings + fundingTotals.interest)}
                  </p>
                </div>
              </div>

              <CollapsibleList className="flex flex-col" itemLabel="months">
                {thriftSummary.fundings.map((funding, index) => {
                  const interestEarned =
                    interestByMonth.get(funding.periodMonth) ?? 0;
                  return (
                    <div
                      key={funding.id}
                      className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                        index > 0 ? "border-t" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {funding.periodLabel}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {funding.reference}
                        </p>
                        <Link
                          href={`/receipts/thrift/${funding.id}`}
                          className="text-xs font-medium text-primary underline underline-offset-2"
                        >
                          Receipt
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-right text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">Funding In</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            +{naira(funding.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Loan Repayment Out
                          </p>
                          <p className="text-sm font-semibold text-red-600">
                            {funding.loanRepayment > 0
                              ? `−${naira(funding.loanRepayment)}`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Interest In</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            {interestEarned > 0
                              ? `+${naira(interestEarned)}`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Net Savings In
                          </p>
                          <p className="text-sm font-semibold text-amber-600">
                            +{naira(funding.thriftCredit + interestEarned)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}