"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";

export type PayrollPreviewRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  gross: number;
  basic: number;
  allowances: number;
  loan: number;
  other: number;
  net: number;
  thrift: number;
  walletCredit: number;
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Read-only payroll preview. Shows what each employee would receive once the
 * chairman approves and disburses the run - nothing is paid from here.
 */
export function PayrollPreviewDialog({
  periodName,
  rows,
  totals,
}: {
  periodName: string;
  rows: PayrollPreviewRow[];
  totals: { net: number; thrift: number; walletCredit: number };
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Eye className="size-4" />
            Preview payroll
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Payroll preview - {periodName}</DialogTitle>
          <DialogDescription>
            What every employee would receive after loan deductions and thrift
            savings. Nothing is paid until the chairman approves and disburses.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Net payable</p>
            <p className="font-mono text-base font-medium">{naira(totals.net)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Thrift savings</p>
            <p className="font-mono text-base font-medium text-amber-600">
              {naira(totals.thrift)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Credited to wallets</p>
            <p className="font-mono text-base font-medium text-emerald-600">
              {naira(totals.walletCredit)}
            </p>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Loan ded.</TableHead>
                <TableHead className="text-right">Other ded.</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Thrift</TableHead>
                <TableHead className="text-right">To wallet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell>
                    <p className="text-sm font-medium">{row.employeeName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.employeeNumber}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {naira(row.gross)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-600">
                    {naira(row.loan)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-600">
                    {naira(row.other)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {naira(row.net)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-amber-600">
                    {naira(row.thrift)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium text-emerald-600">
                    {naira(row.walletCredit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
