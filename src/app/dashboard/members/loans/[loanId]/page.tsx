import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberService } from "@/services/member-service";
import { LoanAnalysis } from "@/components/loans/loan-analysis";
import { MemberRepaymentDialog } from "@/components/dashboard/members/member-repayment-dialog";
import { MemberLoanActions } from "@/components/dashboard/members/member-loan-actions";
import { LoanScheduleActions } from "@/components/loans/loan-schedule-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Member Loan Analysis",
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
  const detail = await service.getMemberLoanDetail(loanId);

  if (!detail) {
    notFound();
  }

  const { loan, schedules } = detail;
  const member = loan.members as unknown as {
    first_name: string;
    last_name: string;
    member_number: string;
  } | null;

  const paid = schedules.reduce(
    (sum, entry) =>
      sum + Math.min(Number(entry.paid_amount) || 0, Number(entry.total_payment) || 0),
    0
  );
  const total = Number(loan.total_repayment) || 0;
  const outstanding = Math.max(0, Math.round((total - paid) * 100) / 100);
  const status = String(loan.status);
  const isPending = ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<Link href="/dashboard/members/loans" />}
          >
            <ArrowLeft className="size-4" />
            Member Loans
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {member ? `${member.first_name} ${member.last_name}` : "Member"} — loan analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {member?.member_number ?? ""}
            {loan.purpose ? ` · ${loan.purpose}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {schedules.length > 0 ? (
            <LoanScheduleActions loanId={String(loan.id)} />
          ) : null}
          <Badge variant={statusVariant(status)}>{status}</Badge>
          {isPending || status === "APPROVED" ? (
            <MemberLoanActions
              applicationId={String(loan.id)}
              status={status}
            />
          ) : status === "ACTIVE" || status === "DISBURSED" ? (
            <MemberRepaymentDialog
              applicationId={String(loan.id)}
              memberName={member ? `${member.first_name} ${member.last_name}` : "Member"}
              outstanding={outstanding}
              monthly={Number(loan.monthly_deduction) || 0}
            />
          ) : null}
        </div>
      </div>

      <LoanAnalysis
        loan={{
          amount: Number(loan.amount) || 0,
          interestRate: Number(loan.interest_rate) || 0,
          interestMethod: String(loan.interest_method ?? "FLAT"),
          durationMonths: Number(loan.duration_months) || 0,
          processingFee: Number(loan.processing_fee) || 0,
          insuranceFee: Number(loan.insurance_fee) || 0,
          totalInterest: Number(loan.total_interest) || 0,
          totalRepayment: total,
          monthly: Number(loan.monthly_deduction) || 0,
          status,
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
