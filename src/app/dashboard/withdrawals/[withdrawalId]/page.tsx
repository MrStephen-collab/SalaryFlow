import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WithdrawalService } from "@/services/withdrawal-service";
import { WithdrawalActions } from "@/components/dashboard/withdrawals/withdrawal-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Withdrawal Detail",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function WithdrawalDetailPage({
  params,
}: {
  params: Promise<{ withdrawalId: string }>;
}) {
  const { withdrawalId } = await params;
  const service = await WithdrawalService.create();
  const withdrawal = await service.getWithdrawal(withdrawalId);

  if (!withdrawal) {
    notFound();
  }

  const fields: { label: string; value: string }[] = [
    { label: "Reference", value: withdrawal.reference },
    { label: "Employee", value: withdrawal.employeeName },
    { label: "Employee Number", value: withdrawal.employeeNumber },
    { label: "Bank", value: withdrawal.bankName },
    { label: "Account Number", value: withdrawal.masked },
    { label: "Account Name", value: withdrawal.accountName },
    { label: "Status", value: withdrawal.status },
    {
      label: "Requested",
      value: new Date(withdrawal.created_at).toLocaleString("en-GB"),
    },
  ];

  if (withdrawal.paid_at) {
    fields.push({
      label: "Paid At",
      value: new Date(withdrawal.paid_at).toLocaleString("en-GB"),
    });
  }
  if (withdrawal.failure_reason) {
    fields.push({ label: "Failure Reason", value: withdrawal.failure_reason });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Withdrawal</h1>
          <p className="text-sm text-muted-foreground">
            {withdrawal.reference}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {withdrawal.status === "PAID" && (
            <Button
              variant="outline"
              render={
                <Link href={`/receipts/withdrawal/${withdrawal.id}`} />
              }
            >
              Receipt
            </Button>
          )}
          <Button
            variant="outline"
            render={<Link href="/dashboard/withdrawals" />}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <WithdrawalActions
            status={withdrawal.status}
            reference={withdrawal.reference}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-2xl font-bold">{naira(Number(withdrawal.amount))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Fee</p>
            <p className="text-2xl font-bold">
              {naira(Number(withdrawal.fee))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Net Payable</p>
            <p className="text-2xl font-bold text-primary">
              {naira(Number(withdrawal.net_amount))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Details</span>
            <Badge>{withdrawal.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}