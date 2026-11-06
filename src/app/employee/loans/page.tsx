import type { Metadata } from "next";
import Link from "next/link";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { thriftBackedLoanLimit } from "@/lib/loan-eligibility";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleList } from "@/components/ui/collapsible-list";
import { HandCoins } from "lucide-react";

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
  switch (status) {
    case "ACTIVE":
    case "COMPLETED":
      return "default" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function EmployeeLoansPage() {
  const service = await EmployeePortalService.create();
  const [loans, eligibility, thriftBalance] = await Promise.all([
    service.getLoans(),
    service.getLoanEligibility(),
    service.getThriftBalance(),
  ]);

  const requiredMonths = eligibility?.requiredMonths ?? 0;
  const eligible = eligibility?.eligible ?? true;
  const loanLimit = thriftBackedLoanLimit(thriftBalance);
  const canApply = eligible && loanLimit > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
          <p className="text-sm text-muted-foreground">
            Track your applications and repayments
          </p>
        </div>
        {canApply ? (
          <Button render={<Link href="/employee/loans/apply" />}>
            <HandCoins className="size-4" />
            Apply for Loan
          </Button>
        ) : (
          <Button disabled>
            <HandCoins className="size-4" />
            Apply for Loan
          </Button>
        )}
      </div>

      {eligible && requiredMonths > 0 ? (
        <p className="text-xs text-muted-foreground">
          Eligible · {requiredMonths}-month employment requirement met
          {eligibility ? ` (${eligibility.monthsWorked} months worked)` : ""}.
        </p>
      ) : null}

      {eligible ? (
        <p className="text-xs text-muted-foreground">
          {loanLimit > 0
            ? `Thrift-backed loan limit: ${naira(loanLimit)} (3× your ${naira(
                thriftBalance
              )} thrift savings). Your monthly repayment must fit within your monthly thrift amount.`
            : "Save in thrift to unlock a loan — your limit is 3× your thrift savings."}
        </p>
      ) : null}

      {!eligible ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Loan eligibility</p>
          <p className="mt-1">
            You must have worked for {requiredMonths} month
            {requiredMonths === 1 ? "" : "s"}
            {requiredMonths >= 12
              ? ` (about ${(requiredMonths / 12).toFixed(1).replace(/\.0$/, "")} year${
                  requiredMonths >= 24 ? "s" : ""
                })`
              : ""}{" "}
            before you can apply for a loan.
          </p>
          <p className="mt-1">
            You have worked {eligibility?.monthsWorked ?? 0} month
            {(eligibility?.monthsWorked ?? 0) === 1 ? "" : "s"} so far
            {eligibility?.remainingMonths
              ? ` — ${eligibility.remainingMonths} more month${
                  eligibility.remainingMonths === 1 ? "" : "s"
                } to go.`
              : "."}
          </p>
        </div>
      ) : null}

      {loans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No loans yet</p>
            <p className="text-sm text-muted-foreground">
              {canApply
                ? "Apply for a thrift-backed loan using your savings."
                : eligible
                  ? "Save in thrift to unlock your first loan."
                  : "You will be able to apply once you meet the employment period."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <CollapsibleList className="flex flex-col gap-3" itemLabel="loans">
          {loans.map((loan) => {
            const total = Number(loan.total_repayment) || 0;
            const progress = Number(loan.progressPercent) || 0;
            return (
              <Link
                key={loan.id}
                href={`/employee/loans/${loan.id}`}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{loan.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Applied {new Date(loan.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{progress}% repaid</Badge>
                    <Badge variant={statusVariant(loan.status)}>{loan.status}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Loan Amount</p>
                    <p className="font-medium">{naira(Number(loan.amount))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly</p>
                    <p className="font-medium">
                      {naira(Number(loan.monthly_deduction))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-medium">{naira(total)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Repayment progress</span>
                    <span>
                      {naira(Number(loan.paidAmount) || 0)} of {naira(total)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </CollapsibleList>
      )}
    </div>
  );
}