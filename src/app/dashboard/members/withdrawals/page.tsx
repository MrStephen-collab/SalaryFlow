import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import { MemberWithdrawalActions } from "@/components/dashboard/members/member-withdrawal-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Member Withdrawals",
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
  const withdrawals = await service.listMemberWithdrawals();

  const pending = withdrawals.filter((w) =>
    ["PENDING", "APPROVED"].includes(w.status)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<Link href="/dashboard/members" />}
          >
            <ArrowLeft className="size-4" />
            Back to members
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Member Withdrawals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wallet withdrawal requests from external members.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting action</CardDescription>
            <CardTitle className="text-2xl">{pending.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total requests</CardDescription>
            <CardTitle className="text-2xl">{withdrawals.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Withdrawal requests</CardTitle>
          <CardDescription>
            Approve as chairman, then mark paid to debit the member&apos;s wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No member withdrawal requests yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={6} itemLabel="withdrawals">
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <p className="font-medium">{withdrawal.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {withdrawal.memberNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(withdrawal.amount)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {withdrawal.bankName ? (
                          <>
                            <p className="font-medium">{withdrawal.bankName}</p>
                            <p className="text-muted-foreground">
                              {withdrawal.accountNumber}
                            </p>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(withdrawal.status)}>
                          {withdrawal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(withdrawal.createdAt).toLocaleDateString("en-NG")}
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberWithdrawalActions
                          withdrawalId={withdrawal.id}
                          status={withdrawal.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
