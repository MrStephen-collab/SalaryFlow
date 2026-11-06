import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoanService } from "@/services/loan-service";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { ApplyLoanForm } from "@/components/employee/apply-loan-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Apply for Loan",
};

export default async function EmployeeApplyLoanPage() {
  const loanService = await LoanService.create();
  const portal = await EmployeePortalService.create();

  const [products, employee, eligibility, thriftBalance] = await Promise.all([
    loanService.listProducts("EMPLOYEE"),
    portal.getEmployee(),
    portal.getLoanEligibility(),
    portal.getThriftBalance(),
  ]);

  if (!employee) {
    redirect("/employee/loans");
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Apply for Loan</h1>
          <Button variant="outline" render={<Link href="/employee/loans" />}>
            <ArrowLeft className="size-4" />
            My Loans
          </Button>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="text-base font-medium">You are not eligible yet</p>
          <p className="mt-2">
            Employees must have worked for {eligibility.requiredMonths} month
            {eligibility.requiredMonths === 1 ? "" : "s"}
            {eligibility.requiredMonths >= 12
              ? ` (about ${(eligibility.requiredMonths / 12).toFixed(1).replace(/\.0$/, "")} year${
                  eligibility.requiredMonths >= 24 ? "s" : ""
                })`
              : ""}{" "}
            before applying for a loan.
          </p>
          <p className="mt-1">
            You have worked {eligibility.monthsWorked} month
            {eligibility.monthsWorked === 1 ? "" : "s"}
            {eligibility.remainingMonths > 0
              ? ` — ${eligibility.remainingMonths} more month${
                  eligibility.remainingMonths === 1 ? "" : "s"
                } to go.`
              : "."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apply for Loan</h1>
          <p className="text-sm text-muted-foreground">
            Choose a product and get an instant repayment estimate
          </p>
        </div>
        <Button variant="outline" render={<Link href="/employee/loans" />}>
          <ArrowLeft className="size-4" />
          My Loans
        </Button>
      </div>

      <ApplyLoanForm
        products={products.filter((p) => p.active)}
        thriftAmount={Number(employee.thrift_amount) || 0}
        thriftBalance={thriftBalance}
      />
    </div>
  );
}