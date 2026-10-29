import type { Metadata } from "next";
import { MemberService } from "@/services/member-service";
import { ApplyLoanDialog } from "@/components/member/apply-loan-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "My Loans",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusVariant(status: string) {
  if (status === "ACTIVE" || status === "APPROVED") return "default" as const;
  if (status === "PENDING") return "secondary" as const;
  return "destructive" as const;
}

export default async function MemberLoansPage() {
  const service = await MemberService.createForStaff();
  const [summary, loans] = await Promise.all([
    service.getMySummary(),
    service.listMyLoans(),
  ]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Borrow up to {summary.loanMultiplier}× your savings after{" "}
            {summary.monthsRequired} months of active membership.
          </p>
        </div>
        <ApplyLoanDialog
          maxLoan={summary.maxLoan}
          eligible={summary.loanEligible}
          monthsRemaining={summary.monthsRemaining}
          hasActiveLoan={Boolean(summary.activeLoan)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your borrowing position</CardTitle>
          <CardDescription>
            {summary.loanEligible
              ? "You are eligible to apply for a loan."
              : `You can apply after ${summary.monthsRemaining} more month(s) of active membership.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Own savings</p>
            <p className="font-mono text-base font-medium">
              {naira(summary.savingsBalance)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Loan limit</p>
            <p className="font-mono text-base font-medium">
              {naira(summary.maxLoan)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Eligibility</p>
            <p className="text-base font-medium">
              {summary.loanEligible ? "Eligible" : `${summary.monthsRemaining} month(s) to go`}
            </p>
          </div>
          {summary.activeLoan ? (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground">Active loan</p>
              <p className="text-base font-medium">
                {naira(summary.activeLoan.amount)} · repay{" "}
                {naira(summary.activeLoan.totalRepayment)} ·{" "}
                {summary.activeLoan.status}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan history</CardTitle>
          <CardDescription>
            Track your applications and approved loans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You have not applied for a loan yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Repayment</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-sm">
                      {loan.submitted_at
                        ? new Date(loan.submitted_at).toLocaleDateString("en-NG")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {naira(Number(loan.amount))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {naira(Number(loan.total_repayment))}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {naira(Number(loan.monthly_deduction))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(loan.status)}>
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {loan.purpose ?? "—"}
                      {loan.status === "REJECTED" && loan.rejection_reason ? (
                        <p className="text-xs text-destructive">
                          {loan.rejection_reason}
                        </p>
                      ) : null}
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
