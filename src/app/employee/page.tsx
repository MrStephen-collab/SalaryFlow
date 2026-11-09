import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { ThriftService } from "@/services/thrift-service";
import { ThriftInterestService } from "@/services/thrift-interest-service";
import { thriftBackedLoanLimit } from "@/lib/loan-eligibility";
import {
  isLoanInProgress,
  loanStatusDescription,
  loanStatusLabel,
  loanStatusTone,
} from "@/lib/loan-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import {
  HandCoins,
  Banknote,
  PiggyBank,
  Wallet,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function EmployeeHomePage() {
  const service = await EmployeePortalService.create();
  if (!service.getEmployeeId()) {
    redirect("/employee/profile");
  }

  const [employee, availableBalance, activeLoan, thriftBalance, thriftSummary, interest, currentLoan] =
    await Promise.all([
      service.getEmployee(),
      service.getAvailableBalance(),
      service.getActiveLoan(),
      service.getThriftBalance(),
      ThriftService.create().then((thrift) => thrift.getMySummary()),
      ThriftInterestService.create().then((thriftInterest) =>
        thriftInterest.getMySummary()
      ),
      service.getCurrentLoan(),
    ]);

  if (!employee) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h1 className="text-lg font-bold">No employee profile yet</h1>
        <p className="text-sm text-muted-foreground">
          You do not have an employee record linked to this account. Contact
          your HR or organization admin.
        </p>
      </div>
    );
  }

  const thriftAmount = Number(employee.thrift_amount) || 0;
  const recentFundings = thriftSummary?.fundings.slice(0, 6) ?? [];
  const hasLoanInProgress = currentLoan
    ? isLoanInProgress(currentLoan.status)
    : false;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <AutoRefresh />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {employee.first_name}
          </h1>
          {interest?.sample ? <Badge variant="outline">Sample data</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee.department ?? "Employee"} · {employee.employee_number} ·{" "}
          {employee.employment_status}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Thrift Amount"
          value={naira(thriftAmount)}
          description={
            employee.thrift_enabled
              ? "Funded by your employer monthly"
              : "Not activated"
          }
          href="/employee/profile"
          icon={Banknote}
          accent="blue"
          delay={0}
        />
        <StatCard
          title="Thrift Savings"
          value={naira(thriftBalance)}
          description="Your accumulated savings"
          href="/employee/money"
          icon={PiggyBank}
          accent="amber"
          delay={80}
        />
        <StatCard
          title="Loan Status"
          value={loanStatusLabel(currentLoan?.status)}
          description={
            currentLoan
              ? `${currentLoan.productName} · ${naira(currentLoan.amount)}`
              : "No application in progress"
          }
          href="/employee/loans"
          icon={HandCoins}
          accent="violet"
          delay={160}
        />
        <StatCard
          title="Wallet"
          value={naira(availableBalance)}
          description="Only withdrawable balance"
          href="/employee/withdrawals"
          icon={Wallet}
          accent="emerald"
          delay={240}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="animate-fade-up" style={{ animationDelay: "280ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Thrift Savings</CardTitle>
              <CardDescription>
                Your monthly thrift funding is applied to any active loan
                instalment first; the remainder grows your savings.
              </CardDescription>
            </div>
            <Badge variant={employee.thrift_enabled ? "default" : "secondary"}>
              {employee.thrift_enabled ? "Active" : "Not active"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Thrift balance</p>
              <p className="text-2xl font-bold text-amber-600">
                {naira(thriftBalance)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground sm:text-right">
              <p>
                Loan eligibility:{" "}
                <span className="font-medium text-foreground">
                  {naira(thriftBackedLoanLimit(thriftBalance))}
                </span>
              </p>
              <p className="text-xs">3× your thrift savings.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "320ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Loan Status</CardTitle>
              <CardDescription>
                {loanStatusDescription(currentLoan?.status)}
              </CardDescription>
            </div>
            {currentLoan ? (
              <Badge variant={loanStatusTone(currentLoan.status)}>
                {loanStatusLabel(currentLoan.status)}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {activeLoan ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Next Funding</p>
                    <p className="text-lg font-bold">
                      {formatDate(activeLoan.nextPaymentDate)}
                      {activeLoan.nextPaymentDue != null && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {naira(activeLoan.nextPaymentDue)}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Outstanding:{" "}
                    <span className="font-semibold text-foreground">
                      {naira(activeLoan.outstanding)}
                    </span>
                  </p>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                    style={{
                      width: `${
                        activeLoan.totalRepayment > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (activeLoan.paid / activeLoan.totalRepayment) * 100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {naira(activeLoan.paid)} paid of {naira(activeLoan.totalRepayment)}
                </p>
              </div>
            ) : currentLoan ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Loan Amount</p>
                    <p className="mt-1 font-semibold">
                      {naira(currentLoan.amount)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Monthly</p>
                    <p className="mt-1 font-semibold">
                      {naira(currentLoan.monthlyDeduction)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Total Repayment
                    </p>
                    <p className="mt-1 font-semibold">
                      {naira(currentLoan.totalRepayment)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <p className="mt-1 font-semibold">
                      {formatDate(currentLoan.submittedAt ?? currentLoan.createdAt)}
                    </p>
                  </div>
                </div>
                {currentLoan.rejectionReason ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {currentLoan.rejectionReason}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/employee/loans/${currentLoan.id}`} />}
                >
                  View application
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You have no active loan. You can apply from the Loans page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "340ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Thrift Interest Growth</CardTitle>
              <CardDescription>
                Daily interest on your opening thrift balance at{" "}
                {interest?.annualRate ?? 5}% per annum. The projected figure is
                the sum of every day&apos;s growth.
              </CardDescription>
            </div>
            {interest?.sample ? (
              <Badge variant="outline">Sample</Badge>
            ) : (
              <Badge variant="secondary">
                {interest?.annualRate ?? 5}% p.a.
              </Badge>
            )}
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Thrift Interest Sum
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-600">
                  {naira(interest?.ytdInterest ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Projected Thrift Interest
                </p>
                <p className="mt-1 text-lg font-bold">
                  {naira(interest?.currentProjection ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {interest?.currentMonthLabel ?? "This month"} month-end
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Lifetime interest
                </p>
                <p className="mt-1 text-lg font-bold">
                  {naira(interest?.lifetimeInterest ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Daily Interest Growth
                </p>
                <p className="mt-1 text-lg font-bold">
                  {naira(interest?.dailyGrowthToDate ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Today +{naira(interest?.dailyGrowth ?? 0)} · Day{" "}
                  {interest?.dayOfMonth ?? 0} of {interest?.daysInMonth ?? 0}
                </p>
              </div>
            </div>
            {interest && interest.months.length > 0 ? (
              <div className="flex flex-col gap-1 border-t pt-2">
                {interest.months.slice(0, 3).map((month) => (
                  <div
                    key={month.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {month.periodLabel}
                    </span>
                    <span className="font-medium text-emerald-600">
                      +{naira(month.interest)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t pt-2 text-xs text-muted-foreground">
                Interest starts after your first full month of thrift savings.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="animate-fade-up" style={{ animationDelay: "360ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Wallet</CardTitle>
              <CardDescription>
                Only money in the wallet can be withdrawn.
              </CardDescription>
            </div>
            <Badge variant="default">Available</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="text-2xl font-bold text-emerald-600">
                {naira(availableBalance)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/employee/money" />}>
                View money
              </Button>
              <Button render={<Link href="/employee/withdrawals" />}>
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {hasLoanInProgress ? (
              <>
                <Button disabled>
                  Apply for Loan
                  <ArrowRight className="size-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  You already have a loan in progress. Repay or wait for the
                  current application to finish before applying again.
                </p>
              </>
            ) : (
              <Button render={<Link href="/employee/loans/apply" />}>
                Apply for Loan
                <ArrowRight className="size-4" />
              </Button>
            )}
            <Button variant="outline" render={<Link href="/employee/money" />}>
              Account Statement
            </Button>
            <Button variant="outline" render={<Link href="/employee/money" />}>
              View thrift savings
            </Button>
            <Button variant="outline" render={<Link href="/employee/withdrawals" />}>
              Withdraw
            </Button>
          </CardContent>
        </Card>
      </div>

      {recentFundings.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: "480ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Thrift Funding</CardTitle>
              <CardDescription>
                Every employer contribution and how it was applied.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/employee/money" />}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFundings.map((funding) => (
              <div
                key={funding.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{funding.periodLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {funding.reference}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{naira(funding.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    Loan {naira(funding.loanRepayment)} · Savings{" "}
                    {naira(funding.thriftCredit)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
