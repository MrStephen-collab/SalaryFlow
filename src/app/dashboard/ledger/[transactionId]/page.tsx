import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";
import { LedgerService } from "@/services/ledger-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { ReverseTransactionDialog } from "@/components/dashboard/ledger/reverse-transaction-dialog";

export const metadata: Metadata = {
  title: "Ledger Transaction",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function LedgerTransactionDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const service = await LedgerService.create();
  const rawTransaction = await service.getTransaction(transactionId);

  if (!rawTransaction) {
    notFound();
  }

  const transaction = rawTransaction as unknown as {
    id: string;
    reference: string;
    description: string | null;
    transaction_date: string;
    transaction_type: string;
    status: string;
    entries: {
      id: string;
      debit: number;
      credit: number;
      description: string | null;
      account_id: string | null;
      financial_account_id: string | null;
    }[];
  };

  const totalDebit = transaction.entries.reduce<number>(
    (s, e) => s + Number(e.debit),
    0
  );
  const totalCredit = transaction.entries.reduce<number>(
    (s, e) => s + Number(e.credit),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Transaction {transaction.reference}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {transaction.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<BackLink href="/dashboard/ledger" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {transaction.status === "POSTED" && (
            <ReverseTransactionDialog transactionId={transaction.id} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Transaction Details
            <Badge
              variant={transaction.status === "REVERSED" ? "destructive" : "default"}
            >
              {transaction.status}
            </Badge>
          </CardTitle>
          <CardDescription>{transaction.transaction_type}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-mono">{transaction.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>{transaction.transaction_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span>{transaction.transaction_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{transaction.status}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries</CardTitle>
          <CardDescription>
            Total debits must equal total credits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {entry.description || "—"}
                    </TableCell>
                    <TableCell>
                      {entry.account_id || entry.financial_account_id ? (
                        <span className="font-mono text-xs">
                          {entry.account_id
                            ? entry.account_id.slice(0, 8)
                            : "EMP-BAL"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.debit > 0 ? naira(entry.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.credit > 0 ? naira(entry.credit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Totals</TableCell>
                  <TableCell className="text-right font-mono">
                    {naira(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {naira(totalCredit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div
            className={`rounded-lg border p-3 text-sm ${
              Math.abs(totalDebit - totalCredit) < 0.005
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {Math.abs(totalDebit - totalCredit) < 0.005
              ? "Balanced ✓"
              : `Unbalanced: debit ${naira(totalDebit)} vs credit ${naira(totalCredit)}`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
