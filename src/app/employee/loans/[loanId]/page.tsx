import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { LoanSettlementService } from "@/services/loan-settlement-service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EarlySettlementCard } from "@/components/employee/loans/early-settlement";
import { LoanAnalysis } from "@/components/loans/loan-analysis";
import { LoanScheduleActions } from "@/components/loans/loan-schedule-actions";

export const metadata: Metadata = {
  title: "Loan Detail",
};

export default async function EmployeeLoanDetailPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  const service = await EmployeePortalService.create();
  const loan = await service.getLoanDetail(loanId);

  if (!loan) {
    notFound();
  }

  const settlement = await LoanSettlementService.create();
  const quoteResult = await settlement.getSettlementQuote(loanId);

  const schedules = (loan.schedule as Array<{
    month_number: number;
    due_date: string | null;
    opening_balance: number | null;
    principal_payment: number;
    interest_payment: number;
    total_payment: number;
    paid_amount: number | null;
    status: string;
  }>) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<Link href="/employee/loans" />}
          >
            <ArrowLeft className="size-4" />
            My Loans
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {loan.productName} analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            {loan.interestRate}% {loan.interestMethod.toLowerCase()} ·{" "}
            {loan.productDuration} months · {String(loan.status)}
          </p>
        </div>
        {schedules.length > 0 ? (
          <LoanScheduleActions loanId={loan.id as string} />
        ) : null}
      </div>

      {quoteResult.quote && (
        <EarlySettlementCard
          applicationId={loan.id as string}
          quote={quoteResult.quote}
        />
      )}

      <LoanAnalysis
        loan={{
          amount: Number(loan.amount) || 0,
          interestRate: Number(loan.interestRate) || 0,
          interestMethod: String(loan.interestMethod ?? "FLAT"),
          durationMonths: Number(loan.productDuration) || Number(loan.duration_months) || 0,
          processingFee: 0,
          insuranceFee: 0,
          totalInterest: Number(loan.total_interest) || 0,
          totalRepayment: Number(loan.total_repayment) || 0,
          monthly: Number(loan.monthly_deduction) || 0,
          status: String(loan.status),
          disbursedAt: loan.disbursed_at,
          purpose: loan.purpose,
        }}
        schedules={schedules.map((entry) => ({
          month: Number(entry.month_number) || 0,
          dueDate: entry.due_date,
          openingBalance: Number(entry.opening_balance) || 0,
          principal: Number(entry.principal_payment) || 0,
          interest: Number(entry.interest_payment) || 0,
          total: Number(entry.total_payment) || 0,
          paid: Number(entry.paid_amount) || 0,
          status: String(entry.status),
        }))}
      />
    </div>
  );
}
