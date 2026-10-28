import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Loan Detail",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusBadge(status: string) {
  switch (status) {
    case "PAID":
      return "default" as const;
    case "DUE":
    case "LATE":
      return "destructive" as const;
    case "WAIVED":
    case "REVERSED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

interface ScheduleEntry {
  id: string;
  month_number: number;
  due_date: string | null;
  principal_payment: number;
  interest_payment: number;
  total_payment: number;
  status: string;
}

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{loan.productName}</h1>
          <p className="text-sm text-muted-foreground">
            {loan.interestRate}% {loan.interestMethod} · {loan.productDuration} months
          </p>
        </div>
        <Button variant="outline" render={<Link href="/employee/loans" />}>
          <ArrowLeft className="size-4" />
          My Loans
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Loan Amount</p>
            <p className="text-lg font-bold">{naira(Number(loan.amount))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Repayment</p>
            <p className="text-lg font-bold">{naira(Number(loan.total_repayment))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600">{naira(loan.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-red-600">{naira(loan.outstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium">Repayment Progress</p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${loan.progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">{loan.outstanding} remaining</span>
            <span>{loan.progress}%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(loan.schedule as ScheduleEntry[]).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {entry.due_date
                      ? new Date(entry.due_date).toLocaleDateString("en-GB", {
                          month: "short",
                          year: "numeric",
                        })
                      : `Month ${entry.month_number}`}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {naira(Number(entry.principal_payment))}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {naira(Number(entry.interest_payment))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {naira(Number(entry.total_payment))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={statusBadge(entry.status)}>{entry.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}