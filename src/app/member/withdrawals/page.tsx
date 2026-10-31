import type { Metadata } from "next";
import { MemberService } from "@/services/member-service";
import { MemberWithdrawalForm } from "@/components/member/member-withdrawal-form";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Withdrawals",
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
    case "PAID":
    case "APPROVED":
      return "default" as const;
    case "REJECTED":
    case "FAILED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function MemberWithdrawalsPage() {
  const service = await MemberService.createForStaff();
  const [summary, withdrawals] = await Promise.all([
    service.getMySummary(),
    service.listMyWithdrawals(),
  ]);

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">No member profile found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact your organization for help.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Withdraw from your wallet balance. Requests are approved by the
          chairman before payment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="size-3.5" />
              Wallet balance
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {naira(summary.walletBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Only your wallet balance can be withdrawn.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Request withdrawal</CardDescription>
          </CardHeader>
          <CardContent>
            <MemberWithdrawalForm max={summary.walletBalance} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Withdrawal history</CardTitle>
          <CardDescription>Your requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No withdrawal requests yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="text-sm">
                      {new Date(withdrawal.created_at).toLocaleDateString("en-NG")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {withdrawal.reference}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {naira(Number(withdrawal.net_amount ?? withdrawal.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(withdrawal.status)}>
                        {withdrawal.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
