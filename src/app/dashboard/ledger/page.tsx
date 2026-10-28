import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
import { LedgerService } from "@/services/ledger-service";

export const metadata: Metadata = {
  title: "Ledger",
};

export default async function LedgerPage() {
  const service = await LedgerService.create();
  const transactions = await service.listTransactions(200);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable double-entry transactions and audit trail
          </p>
        </div>
        <Button render={<Link href="/dashboard/funds" />}>
          Fund Management
        </Button>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Financial transactions will appear here as loans are disbursed and repaid.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={6} itemLabel="transactions">
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs">
                    {tx.reference}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="secondary">{tx.transaction_type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm">
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-sm">
                    {tx.transaction_date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tx.status === "REVERSED" ? "destructive" : "default"}
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/dashboard/ledger/${tx.id}`} />}
                    >
                      Detail
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
