import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import { ApplyLoanDialog } from "@/components/member/apply-loan-dialog";
import { Button } from "@/components/ui/button";
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
  const [summary, loans, terms] = await Promise.all([
    service.getMySummary(),
    service.listMyLoans(),
    service.getLoanTerms(),
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
          collateralRequired={terms?.collateralRequired ?? false}
          interestRate={terms?.interestRate ?? 1}
          processingFee={terms?.processingFee ?? 0}
          insuranceFee={terms?.insuranceFee ?? 0}
          durationMonths={terms?.durationMonths ?? 6}
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

      {(() => {
        const active = loans.find((loan) =>
          ["ACTIVE", "DISBURSED"].includes(String(loan.status))
        );
        if (!active) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active loan analysis</CardTitle>
              <CardDescription>
                The full approved amount was disbursed — no fees were deducted
                from your loan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Loan amount</p>
                  <p className="font-mono text-base font-medium text-emerald-600">
                    {naira(Number(active.amount) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Credited to wallet</p>
                  <p className="font-mono text-base font-medium text-emerald-600">
                    {naira(
                      Math.max(
                        0,
                        (Number(active.amount) || 0) -
                          (Number(active.processing_fee) || 0) -
                          (Number(active.insurance_fee) || 0)
                      )
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interest</p>
                  <p className="font-mono text-base font-medium">
                    {naira(Number(active.total_interest) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Processing fee</p>
                  <p className="font-mono text-base font-medium">
                    {naira(Number(active.processing_fee) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Insurance fee</p>
                  <p className="font-mono text-base font-medium">
                    {naira(Number(active.insurance_fee) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total repayment</p>
                  <p className="font-mono text-base font-medium">
                    {naira(Number(active.total_repayment) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monthly repayment</p>
                  <p className="font-mono text-base font-medium">
                    {naira(Number(active.monthly_deduction) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outstanding</p>
                  <p className="font-mono text-base font-medium text-primary">
                    {naira(Number(active.outstanding) || 0)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Repayment progress</span>
                  <span>{Number(active.progressPercent) || 0}% repaid</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                    style={{ width: `${Number(active.progressPercent) || 0}%` }}
                  />
                </div>
              </div>

              {active.collateral_description ? (
                <p className="text-xs text-muted-foreground">
                  Collateral: {String(active.collateral_description)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })()}

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
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Insurance</TableHead>
                  <TableHead className="text-right">Repayment</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Analysis</TableHead>
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
                      {naira(Number(loan.total_interest) || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {naira(Number(loan.processing_fee) || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {naira(Number(loan.insurance_fee) || 0)}
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/member/loans/${loan.id}`} />}
                      >
                        View
                      </Button>
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
