import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberService } from "@/services/member-service";
import { LoanAnalysis } from "@/components/loans/loan-analysis";
import { LoanScheduleActions } from "@/components/loans/loan-schedule-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Loan Analysis",
};

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
    case "COMPLETED":
      return "default" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function MemberLoanDetailPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  const service = await MemberService.createForStaff();
  const detail = await service.getLoanDetailForMember(loanId);

  if (!detail) {
    notFound();
  }

  const { loan, schedules } = detail;
  const product = loan.loan_products as unknown as { name: string } | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<Link href="/member/loans" />}
          >
            <ArrowLeft className="size-4" />
            My Loans
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {product?.name ?? "Loan"} analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loan.purpose ?? "Member loan"}
          </p>
        </div>
        <Badge variant={statusVariant(String(loan.status))}>
          {String(loan.status)}
        </Badge>
      </div>

      {schedules.length > 0 ? (
        <LoanScheduleActions loanId={loan.id as string} />
      ) : null}

      <LoanAnalysis
        loan={{
          amount: Number(loan.amount) || 0,
          interestRate: Number(loan.interest_rate) || 0,
          interestMethod: String(loan.interest_method ?? "FLAT"),
          durationMonths: Number(loan.duration_months) || 0,
          processingFee: Number(loan.processing_fee) || 0,
          insuranceFee: Number(loan.insurance_fee) || 0,
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
