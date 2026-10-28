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

  const [products, employee] = await Promise.all([
    loanService.listProducts(),
    portal.getEmployee(),
  ]);

  if (!employee) {
    redirect("/employee/loans");
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
        employee={employee}
      />
    </div>
  );
}