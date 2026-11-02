import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoanService } from "@/services/loan-service";
import { ApplyForLoanForm } from "@/components/dashboard/loans/apply-for-loan-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Apply for Loan",
};

export default async function ApplyForLoanPage() {
  const service = await LoanService.create();
  const [products, employee] = await Promise.all([
    service.listProducts(),
    service.getCurrentEmployee(),
  ]);

  if (!employee) {
    redirect("/dashboard/loans");
  }

  const { thriftBalance } = await service.getThriftLoanLimit(employee.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apply for Loan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a product and get an instant repayment estimate
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link href="/dashboard/loans/applications" />}
        >
          <ArrowLeft className="size-4" />
          Back to Applications
        </Button>
      </div>

      <ApplyForLoanForm
        products={products}
        employee={employee}
        thriftBalance={thriftBalance}
      />
    </div>
  );
}
