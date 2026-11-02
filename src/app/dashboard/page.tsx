import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getOrganization } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard, type StatAccent } from "@/components/ui/stat-card";
import { Users, HandCoins, PiggyBank, Percent } from "lucide-react";
import { EmployeeService } from "@/services/employee-service";
import { FundService } from "@/services/fund-service";
import { DeductionService } from "@/services/deduction-service";
import { WithdrawalService } from "@/services/withdrawal-service";
import { LoanService } from "@/services/loan-service";
import { MemberService } from "@/services/member-service";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";

export const metadata: Metadata = {
  title: "Dashboard",
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
    case "ACTIVE":
    case "PAID":
    case "APPROVED":
    case "COMPLETED":
      return "default" as const;
    case "REJECTED":
    case "DEFAULTED":
    case "FAILED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function DashboardPage() {
  await requireUser();
  const organization = await getOrganization();

  const employeeService = await EmployeeService.create();
  const fundService = await FundService.create();
  const deductionService = await DeductionService.create();
  const withdrawalService = await WithdrawalService.create();
  const loanService = await LoanService.create();
  const memberService = await MemberService.createForStaff();

  const [employeeList, applications, fundAccounts, deductions, withdrawals, repayments, membersOverview, memberApplications] =
    await Promise.all([
      employeeService.list({ pageSize: 1 }),
      loanService.listApplications(),
      fundService.listFundAccounts(),
      deductionService.listDeductions(),
      withdrawalService.listWithdrawals(),
      loanService.listRepayments(undefined, 5),
      memberService.getMembersOverview(),
      memberService.listMemberApplications(),
    ]);

  const fundBalances = await Promise.all(
    fundAccounts.map(async (account) => ({
      id: account.id,
      balance: await fundService.fundAccountBalance(account.id),
    }))
  );

  const totalFunds = fundBalances.reduce((s, a) => s + a.balance, 0);
  const activeLoans = applications.filter(
    (app) => app.status === "ACTIVE" || app.status === "DISBURSED"
  );

  const now = new Date();
  const monthlyDeductions = deductions
    .filter((d) => {
      const dDate = new Date(d.created_at);
      return (
        dDate.getFullYear() === now.getFullYear() &&
        dDate.getMonth() === now.getMonth()
      );
    })
    .reduce((s, d) => s + (Number(d.expected_amount) || 0), 0);

  const pendingApplications = applications.filter(
    (app) =>
      app.status === "PENDING" ||
      app.status === "SUBMITTED" ||
      app.status === "UNDER_REVIEW"
  );
  const pendingWithdrawals = withdrawals.filter(
    (w) => w.status === "PENDING" || w.status === "REVIEW"
  );

  const pendingMemberLoans = memberApplications.filter((application) =>
    ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(application.status)
  );
  const pendingMemberships = membersOverview?.pending ?? 0;
  const totalPendingApprovals =
    pendingApplications.length +
    pendingWithdrawals.length +
    pendingMemberLoans.length +
    pendingMemberships;

  const stats = [
    {
      title: "Total Employees",
      value: employeeList.total.toLocaleString(),
      description: "People in your active workforce",
      href: "/dashboard/employees",
      icon: Users,
      accent: "blue",
    },
    {
      title: "Active Loans",
      value: activeLoans.length.toLocaleString(),
      description: `${pendingApplications.length} pending review`,
      href: "/dashboard/loans/applications",
      icon: HandCoins,
      accent: "emerald",
    },
    {
      title: "Lending Funds",
      value: naira(totalFunds),
      description: "Across all fund accounts",
      href: "/dashboard/funds",
      icon: PiggyBank,
      accent: "amber",
    },
    {
      title: "Deductions (This Month)",
      value: naira(monthlyDeductions),
      description: "Expected loan deductions",
      href: "/dashboard/deductions",
      icon: Percent,
      accent: "rose",
    },
  ] satisfies {
    title: string;
    value: string;
    description: string;
    href: string;
    icon: typeof Users;
    accent: StatAccent;
  }[];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization
            ? `${organization.name} overview`
            : "Complete your organization setup to get started"}
        </p>
      </div>

      <AutoRefresh />
      {(pendingApplications.length > 0 || pendingWithdrawals.length > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Approvals waiting for the chairman</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {pendingWithdrawals.length > 0 ? (
              <Link href="/dashboard/withdrawals" className="underline">
                {pendingWithdrawals.length} withdrawal request
                {pendingWithdrawals.length === 1 ? "" : "s"}
              </Link>
            ) : null}
            {pendingApplications.length > 0 ? (
              <Link href="/dashboard/loans/applications" className="underline">
                {pendingApplications.length} loan application
                {pendingApplications.length === 1 ? "" : "s"}
              </Link>
            ) : null}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            href={stat.href}
            icon={stat.icon}
            accent={stat.accent}
            delay={i * 80}
          />
        ))}
      </div>

      {membersOverview ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <StatCard
            title="Total Members"
            value={membersOverview.members.toLocaleString()}
            description={`${membersOverview.active} active · ${membersOverview.pending} pending approval`}
            href="/dashboard/members"
            icon={Users}
            accent="blue"
            delay={720}
          />
          <StatCard
            title="Member Savings Deposited"
            value={naira(Math.round(membersOverview.savingsDeposited * 100) / 100)}
            description="Across member savings wallets"
            href="/dashboard/members/savings"
            icon={PiggyBank}
            accent="emerald"
            delay={800}
          />
          <StatCard
            title="Member Loans Disbursed"
            value={naira(Math.round(membersOverview.savingsLent * 100) / 100)}
            description="Principal lent from savings"
            href="/dashboard/members/loans"
            icon={HandCoins}
            accent="amber"
            delay={880}
          />
          <StatCard
            title="Pending Approvals"
            value={totalPendingApprovals.toLocaleString()}
            description="Members · loans · withdrawals"
            href="/dashboard/approvals"
            icon={Percent}
            accent="rose"
            delay={960}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="animate-fade-up" style={{ animationDelay: "320ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link
              href="/dashboard/loans/applications"
              className="group flex items-center justify-between rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/60 hover:shadow-sm"
            >
              <div>
                <p className="text-sm font-medium">Loan applications</p>
                <p className="text-xs text-muted-foreground">
                  Awaiting review or approval
                </p>
              </div>
              <Badge variant="secondary">{pendingApplications.length}</Badge>
            </Link>
            <Link
              href="/dashboard/withdrawals"
              className="group flex items-center justify-between rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/60 hover:shadow-sm"
            >
              <div>
                <p className="text-sm font-medium">Withdrawal requests</p>
                <p className="text-xs text-muted-foreground">
                  Awaiting review or processing
                </p>
              </div>
              <Badge variant="secondary">{pendingWithdrawals.length}</Badge>
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button render={<Link href="/dashboard/employees" />}>
              Add employees
            </Button>
            <Button variant="outline" render={<Link href="/dashboard/salary/import" />}>
              Import salary
            </Button>
            <Button variant="outline" render={<Link href="/dashboard/loans" />}>
              Manage loan products
            </Button>
            <Button variant="outline" render={<Link href="/dashboard/deductions" />}>
              Generate deductions
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up" style={{ animationDelay: "480ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Applications</CardTitle>
              <CardDescription>Latest loan applications</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/dashboard/loans/applications" />}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No applications yet
              </p>
            ) : (
              <div className="grid gap-2">
                {applications.slice(0, 5).map((app) => (
                  <Link
                    key={app.id}
                    href={
                      app.borrowerType === "MEMBER"
                        ? "/dashboard/members"
                        : `/dashboard/loans/applications/${app.id}`
                    }
                    className="flex items-center justify-between rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/60 hover:shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-medium">{app.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {app.productName} · {naira(app.amount)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(app.status)}>
                      {app.status.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "560ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Repayments</CardTitle>
              <CardDescription>Latest recorded repayments</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/dashboard/repayments" />}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {repayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No repayments recorded yet
              </p>
            ) : (
              <div className="grid gap-2">
                {repayments.map((repayment) => (
                  <div
                    key={repayment.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/60 hover:shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {repayment.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(repayment.recorded_at).toLocaleDateString(
                          "en-NG"
                        )}{" "}
                        · {repayment.productName}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-green-600">
                      +{naira(Number(repayment.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}