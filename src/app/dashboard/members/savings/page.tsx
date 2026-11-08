import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Member Savings",
};

export const dynamic = "force-dynamic";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function activityLabel(type: string, reference: string) {
  if (type === "DEPOSIT") {
    return reference.startsWith("SAV-REPAY")
      ? "Savings from repayment"
      : "Savings deposit";
  }
  if (type === "WITHDRAWAL") {
    return reference.startsWith("SAV-LOAN")
      ? "Savings applied to loan"
      : "Savings withdrawal";
  }
  return type;
}

export default async function MemberSavingsPage() {
  const service = await MemberService.createForStaff();
  const overview = await service.getSavingsOverview();

  if (!overview) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">No savings data</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add members and they will start saving here.
          </p>
        </CardContent>
      </Card>
    );
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Member Savings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every member&apos;s savings, wallet balance and deposit activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardHeader className="px-3 pb-0 sm:px-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">
              Member Savings
            </CardDescription>
            <CardTitle className="text-lg text-primary sm:text-2xl">
              {naira(overview.totals.savings)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardHeader className="px-3 pb-0 sm:px-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">
              Wallets
            </CardDescription>
            <CardTitle className="text-lg sm:text-2xl">
              {naira(overview.totals.wallet)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardHeader className="px-3 pb-0 sm:px-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">
              Total Deposited
            </CardDescription>
            <CardTitle className="text-lg sm:text-2xl">
              {naira(overview.totals.deposited)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardHeader className="px-3 pb-0 sm:px-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">
              Total Withdrawn
            </CardDescription>
            <CardTitle className="text-lg sm:text-2xl">
              {naira(overview.totals.withdrawn)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            Savings are locked for loan eligibility; wallet balances can be
            withdrawn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                    <TableHead className="text-right">Deposited</TableHead>
                    <TableHead className="text-right">Withdrawn</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={6} itemLabel="members">
                  {overview.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.memberNumber} · {member.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(member.savingsBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(member.walletBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600">
                        {naira(member.totalDeposited)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">
                        {naira(member.totalWithdrawn)}
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent savings activity</CardTitle>
          <CardDescription>
            Deposits, repayments credited to savings and savings applied to loans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No savings activity yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={5} itemLabel="transactions">
                  {overview.activity.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        {new Date(item.createdAt).toLocaleDateString("en-NG")}
                      </TableCell>
                      <TableCell className="text-sm">{item.memberName}</TableCell>
                      <TableCell className="text-sm">
                        {activityLabel(item.type, item.reference)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-medium ${
                          item.direction === "IN"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.direction === "IN" ? "+" : "-"}
                        {naira(item.amount)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.reference}
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
