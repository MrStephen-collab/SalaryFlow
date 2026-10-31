import type { Metadata } from "next";
import { MemberService } from "@/services/member-service";
import { gatewayStatus } from "@/services/payment-provider";
import { DepositDialog } from "@/components/member/deposit-dialog";
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
import { PiggyBank, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "My Savings",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function MemberSavingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    payment?: string;
    amount?: string;
    reason?: string;
    ref?: string;
  }>;
}) {
  const params = await searchParams;
  const service = await MemberService.createForStaff();
  const summary = await service.getMySummary();
  const gateway = gatewayStatus();

  if (!summary) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h1 className="text-lg font-bold">No member profile yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This account is not linked to a member record. Contact your
          organization for help.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Savings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.member.memberNumber} · {summary.member.email}
          </p>
        </div>
        <DepositDialog
          gatewayReady={gateway.collections}
          activeLoanOutstanding={summary.activeLoan?.outstanding ?? 0}
        />
      </div>

      {params.payment === "success" && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Payment confirmed. Your savings have been credited
          {params.amount ? ` with ${naira(Number(params.amount))}` : ""}.
        </div>
      )}

      {params.payment === "pending" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          We have not received confirmation from the payment provider yet. If you
          were debited, this page will update automatically - refresh in a moment.
          {params.reason ? ` (${params.reason})` : ""}
        </div>
      )}

      {params.payment === "failed" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {params.reason ?? "The payment did not go through."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <PiggyBank className="size-3.5" />
              My Savings
            </CardDescription>
            <CardTitle className="text-2xl text-primary">
              {naira(summary.savingsBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.activeLoan
              ? "Savings applied to your active loan — fresh savings grow as you repay"
              : "Savings are held for you and are not withdrawable"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="size-3.5" />
              Wallet Balance
            </CardDescription>
            <CardTitle className="text-2xl">
              {naira(summary.walletBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Withdrawable balance (loan proceeds)
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deposited</CardDescription>
            <CardTitle className="text-2xl">
              {naira(summary.totalDeposited)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Withdrawn</CardDescription>
            <CardTitle className="text-2xl">
              {naira(summary.totalWithdrawn)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings history</CardTitle>
          <CardDescription>
            Every deposit is confirmed by the payment provider before it appears
            here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No savings activity yet. Use “Add Savings” to make your first
              deposit.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {new Date(tx.createdAt).toLocaleDateString("en-NG")}
                    </TableCell>
                    <TableCell className="text-sm">{tx.type}</TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        tx.direction === "IN" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.direction === "IN" ? "+" : "-"}
                      {naira(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tx.direction === "IN" ? "default" : "secondary"}
                      >
                        {tx.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.reference}
                    </TableCell>
                    <TableCell className="text-sm">
                      {tx.description ?? "—"}
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
