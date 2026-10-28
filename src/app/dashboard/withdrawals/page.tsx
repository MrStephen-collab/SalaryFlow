import type { Metadata } from "next";
import Link from "next/link";
import { WithdrawalService } from "@/services/withdrawal-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { Badge } from "@/components/ui/badge";

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
      return "default" as const;
    case "FAILED":
    case "REJECTED":
      return "destructive" as const;
    case "PROCESSING":
      return "secondary" as const;
    case "APPROVED":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

const statuses = [
  "PENDING",
  "REVIEW",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REJECTED",
];

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const service = await WithdrawalService.create();
  const withdrawals = await service.listWithdrawals(status);

  const totals = withdrawals.reduce(
    (acc, w) => {
      acc.count += 1;
      if (w.status === "PAID") acc.paid += Number(w.amount) || 0;
      acc.pending += w.status === "PENDING" || w.status === "REVIEW" ? Number(w.amount) || 0 : 0;
      return acc;
    },
    { count: 0, paid: 0, pending: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdrawals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and process employee withdrawal requests
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!status ? "default" : "outline"}
          render={<Link href="/dashboard/withdrawals" />}
        >
          All
        </Button>
        {statuses.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            render={<Link href={`/dashboard/withdrawals?status=${s}`} />}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Requests</p>
            <p className="text-lg font-bold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Pending Amount</p>
            <p className="text-lg font-bold">{naira(totals.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Paid Out</p>
            <p className="text-lg font-bold text-green-600">
              {naira(totals.paid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {withdrawals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No withdrawals found</p>
            <p className="text-sm text-muted-foreground">
              Employee withdrawal requests will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Bank Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={6} itemLabel="withdrawals">
              {withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{w.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.employeeNumber}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {w.bankName}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {w.masked}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {naira(Number(w.amount))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.reference}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/dashboard/withdrawals/${w.id}`} />}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </CollapsibleTableBody>
          </Table>
        </div>
      )}
    </div>
  );
}