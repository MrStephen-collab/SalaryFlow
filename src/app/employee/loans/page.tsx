import type { Metadata } from "next";
import Link from "next/link";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const loans = await service.getLoans();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
          <p className="text-sm text-muted-foreground">
            Track your applications and repayments
          </p>
        </div>
        <Button render={<Link href="/employee/loans/apply" />}>
          <HandCoins className="size-4" />
          Apply for Loan
        </Button>
      </div>

      {loans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No loans yet</p>
            <p className="text-sm text-muted-foreground">
              Apply for your first salary-backed loan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {loans.map((loan) => {
            const total = Number(loan.total_repayment) || 0;
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
                  <Badge variant={statusVariant(loan.status)}>{loan.status}</Badge>
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}