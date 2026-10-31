import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import { gatewayStatus } from "@/services/payment-provider";
import { DepositDialog } from "@/components/member/deposit-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarClock, HandCoins, PiggyBank, Wallet } from "lucide-react";

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

export default async function MemberHomePage() {
  const service = await MemberService.createForStaff();
  const summary = await service.getMySummary();
  const gateway = gatewayStatus();

  if (!summary) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h1 className="text-lg font-bold">No member profile yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This account is not linked to a member record. Contact your
          organization for help.
        </p>
      </div>
    );
  }

  const progress =
    summary.monthsRequired > 0
      ? Math.min(
          100,
          Math.round((summary.monthsActive / summary.monthsRequired) * 100)
        )
      : 100;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {summary.member.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.member.memberNumber} · Joined{" "}
            {new Date(summary.member.joinedAt).toLocaleDateString("en-NG")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={summary.member.status === "ACTIVE" ? "default" : "secondary"}>
            {summary.member.status}
          </Badge>
          <Button variant="outline" render={<Link href="/member/loans" />}>
            <HandCoins className="size-4" />
            My Loans
          </Button>
          <DepositDialog
            gatewayReady={gateway.collections}
            activeLoanOutstanding={summary.activeLoan?.outstanding ?? 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="My Savings"
          value={naira(summary.savingsBalance)}
          description={
            summary.activeLoan
              ? "Applied to loan · fresh savings grow"
              : "Savings · not withdrawable"
          }
          href="/member/savings"
          icon={PiggyBank}
          accent="emerald"
          delay={0}
        />
        <StatCard
          title="Wallet Balance"
          value={naira(summary.walletBalance)}
          description="Withdrawable balance"
          href="/member/withdrawals"
          icon={Wallet}
          accent="blue"
          delay={80}
        />
        <StatCard
          title="Membership"
          value={`${summary.monthsActive} month${summary.monthsActive === 1 ? "" : "s"}`}
          description={
            summary.monthsRemaining > 0
              ? `${summary.monthsRemaining} to loan eligibility`
              : "Loan eligible"
          }
          icon={CalendarClock}
          accent="amber"
          delay={160}
        />
        <StatCard
          title="Loan Limit"
          value={naira(summary.maxLoan)}
          description={`${summary.loanMultiplier}× your savings`}
          href="/member/loans"
          icon={HandCoins}
          accent="violet"
          delay={240}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan eligibility</CardTitle>
          <CardDescription>
            {summary.loanEligible
              ? "You have completed the required membership period and can apply for a loan."
              : `You can borrow after ${summary.monthsRequired} months of active membership.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {summary.monthsActive} of {summary.monthsRequired} months
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <div>
              <p className="text-muted-foreground">Maximum you can borrow</p>
              <p className="font-mono text-lg font-semibold">
                {naira(summary.maxLoan)}
              </p>
              {!summary.loanEligible ? (
                <p className="text-xs text-muted-foreground">
                  Keep saving and check back after your membership period.
                </p>
              ) : null}
            </div>
            <Button
              variant={summary.loanEligible ? "default" : "outline"}
              disabled={!summary.loanEligible}
              render={<Link href="/member/loans" />}
            >
              {summary.loanEligible ? "Go to loans" : "Not yet eligible"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary.activeLoan ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active loan</CardTitle>
            <CardDescription>
              Approved on your savings history · {summary.activeLoan.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Principal</p>
              <p className="font-mono text-base font-medium">
                {naira(summary.activeLoan.amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total repayment</p>
              <p className="font-mono text-base font-medium">
                {naira(summary.activeLoan.totalRepayment)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Disbursed</p>
              <p className="text-base font-medium">
                {summary.activeLoan.disbursedAt
                  ? new Date(summary.activeLoan.disbursedAt).toLocaleDateString("en-NG")
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent savings activity</CardTitle>
          <CardDescription>Your last deposits and withdrawals.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No savings activity yet. Add savings to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.transactions.slice(0, 8).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {new Date(tx.createdAt).toLocaleDateString("en-NG")}
                    </TableCell>
                    <TableCell className="text-sm">{tx.type}</TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        tx.direction === "IN" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.direction === "IN" ? "+" : "-"}
                      {naira(tx.amount)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.reference}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
