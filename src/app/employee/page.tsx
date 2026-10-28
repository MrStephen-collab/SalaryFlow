import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmployeePortalService } from "@/services/employee-portal-service";
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
import {
  HandCoins,
  Banknote,
  Wallet,
  ArrowDownUp,
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

  const [employee, history, availableBalance, activeLoan] = await Promise.all([
    service.getEmployee(),
    service.getSalaryHistory(),
    service.getAvailableBalance(),
    service.getActiveLoan(),
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

  const salary = history[0]?.grossSalary ?? (Number(employee.salary) || 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {employee.first_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee.department ?? "Employee"} · {employee.employee_number} ·{" "}
          {employee.employment_status}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Salary"
          value={naira(salary)}
          description="Monthly gross pay"
          href="/employee/salary"
          icon={Banknote}
          accent="blue"
          delay={0}
        />
        <StatCard
          title="Available Balance"
          value={naira(availableBalance)}
          description="Ready to withdraw"
          href="/employee/money"
          icon={Wallet}
          accent="emerald"
          delay={80}
        />
        <StatCard
          title="Active Loan"
          value={naira(activeLoan?.outstanding ?? 0)}
          description={activeLoan ? activeLoan.productName : "No active loan"}
          href="/employee/loans"
          icon={HandCoins}
          accent="violet"
          delay={160}
        />
        <StatCard
          title="Monthly Deduction"
          value={naira(activeLoan?.monthlyDeduction ?? 0)}
          description="Next loan payment"
          href="/employee/withdrawals"
          icon={ArrowDownUp}
          accent="rose"
          delay={240}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="animate-fade-up" style={{ animationDelay: "320ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Loan</CardTitle>
              <CardDescription>Your current loan position</CardDescription>
            </div>
            {activeLoan && <Badge>{activeLoan.productName}</Badge>}
          </CardHeader>
          <CardContent>
            {activeLoan ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Next Deduction</p>
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
            ) : (
              <p className="text-sm text-muted-foreground">
                You have no active loan. You can apply from the Loans page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button render={<Link href="/employee/loans/apply" />}>
              Apply for Loan
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" render={<Link href="/employee/salary" />}>
              View Salary
            </Button>
            <Button variant="outline" render={<Link href="/employee/money" />}>
              Account Statement
            </Button>
            <Button variant="outline" render={<Link href="/employee/withdrawals" />}>
              Withdraw
            </Button>
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: "480ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Latest Payslip</CardTitle>
              <CardDescription>{history[0].periodName}</CardDescription>
            </div>
            <Badge variant="secondary">{history[0].periodStatus || "slip"}</Badge>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross</span>
              <span>{naira(history[0].grossSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Deduction</span>
              <span className="text-red-600">
                -{naira(history[0].loanDeductions)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Other Deductions</span>
              <span className="text-red-600">
                -{naira(history[0].otherDeductions)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Net Pay</span>
              <span className="text-lg font-bold text-primary">
                {naira(history[0].netSalary)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}