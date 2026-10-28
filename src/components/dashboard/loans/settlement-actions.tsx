"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  restructureLoan,
  settleLoanEarly,
} from "@/app/dashboard/loans/actions";
import type {
  RestructureHistoryEntry,
  RestructureMode,
  SettlementQuote,
} from "@/services/loan-settlement-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, HandCoins, History, RefreshCw } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function nextMonthStart() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MODE_LABELS: Record<RestructureMode, string> = {
  EXTEND: "Extend repayment period",
  RESCHEDULE: "Reschedule instalments",
  CHANGE_AMOUNT: "Set a new monthly amount",
};

export function SettlementActions({
  applicationId,
  quote,
  history,
}: {
  applicationId: string;
  quote: SettlementQuote;
  history: RestructureHistoryEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [settleOpen, setSettleOpen] = useState(false);
  const [settleNote, setSettleNote] = useState("");

  const [restructureOpen, setRestructureOpen] = useState(false);
  const [mode, setMode] = useState<RestructureMode>("EXTEND");
  const [months, setMonths] = useState("6");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState(nextMonthStart());
  const [note, setNote] = useState("");

  const handleSettle = () => {
    startTransition(async () => {
      const result = await settleLoanEarly(
        applicationId,
        settleNote.trim() || undefined
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setSettleOpen(false);
      setSettleNote("");
      router.refresh();
    });
  };

  const handleRestructure = () => {
    const input = {
      mode,
      months: mode === "CHANGE_AMOUNT" ? undefined : Number(months),
      monthlyAmount:
        mode === "CHANGE_AMOUNT" ? Number(monthlyAmount) : undefined,
      startDate,
      note: note.trim() || undefined,
    };

    if (mode !== "CHANGE_AMOUNT") {
      if (!Number.isFinite(input.months) || (input.months ?? 0) < 1) {
        toast.error("Enter a repayment period between 1 and 60 months");
        return;
      }
    } else if (
      !Number.isFinite(input.monthlyAmount) ||
      (input.monthlyAmount ?? 0) <= 0
    ) {
      toast.error("Enter a monthly amount greater than 0");
      return;
    }

    startTransition(async () => {
      const result = await restructureLoan(applicationId, input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setRestructureOpen(false);
      setNote("");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Early Settlement &amp; Restructuring</CardTitle>
          <CardDescription>
            Outstanding balance as of {formatDate(quote.asOf)} ·{" "}
            {quote.installmentsOutstanding} instalment
            {quote.installmentsOutstanding === 1 ? "" : "s"} left
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
            <DialogTrigger
              render={
                <Button>
                  <HandCoins className="size-4" />
                  Settle early
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Settle loan early</DialogTitle>
                <DialogDescription>
                  Records the settlement payment now, closes the remaining
                  instalments and posts the accounting entries.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal</span>
                    <span className="font-medium">
                      {naira(quote.outstandingPrincipal)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">
                      Accrued interest
                    </span>
                    <span className="font-medium">
                      {naira(quote.accruedInterest)}
                    </span>
                  </div>
                  {quote.discount > 0 && (
                    <div className="mt-1 flex justify-between text-green-600">
                      <span>Future interest waived</span>
                      <span className="font-medium">
                        −{naira(quote.discount)}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="font-medium">{naira(quote.fee)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t pt-2 text-base">
                    <span className="font-semibold">Total to settle</span>
                    <span className="font-bold">{naira(quote.total)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Textarea
                    value={settleNote}
                    onChange={(event) => setSettleNote(event.target.value)}
                    placeholder="e.g. Employee paid by bank transfer"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSettleOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSettle} disabled={isPending}>
                  {isPending ? "Settling..." : `Settle ${naira(quote.total)}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={restructureOpen} onOpenChange={setRestructureOpen}>
            <DialogTrigger
              render={
                <Button variant="outline">
                  <RefreshCw className="size-4" />
                  Restructure
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Restructure loan</DialogTitle>
                <DialogDescription>
                  Replaces the remaining instalments with a new version. The
                  original instalments are kept as waived history.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Restructure type</Label>
                  <Select
                    value={mode}
                    onValueChange={(value) => setMode(value as RestructureMode)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(MODE_LABELS) as RestructureMode[]
                      ).map((key) => (
                        <SelectItem key={key} value={key}>
                          {MODE_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Outstanding principal
                    </span>
                    <span className="font-medium">
                      {naira(quote.outstandingPrincipal)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">
                      Remaining interest
                    </span>
                    <span className="font-medium">
                      {naira(quote.outstandingInterest)}
                    </span>
                  </div>
                </div>

                {mode === "CHANGE_AMOUNT" ? (
                  <div className="space-y-2">
                    <Label>New monthly amount (₦) *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={monthlyAmount}
                      onChange={(event) =>
                        setMonthlyAmount(event.target.value)
                      }
                      placeholder="e.g. 25000"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Repayment period (months) *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={months}
                      onChange={(event) => setMonths(event.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>First instalment date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Reduced salary due to unpaid leave"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRestructureOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleRestructure} disabled={isPending}>
                  {isPending ? "Restructuring..." : "Apply restructure"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Outstanding principal</p>
          <p className="mt-1 font-semibold">
            {naira(quote.outstandingPrincipal)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Accrued interest</p>
          <p className="mt-1 font-semibold">{naira(quote.accruedInterest)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Future interest waived</p>
          <p className="mt-1 font-semibold text-green-600">
            {naira(quote.discount)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Settlement total</p>
          <p className="mt-1 font-semibold">{naira(quote.total)}</p>
        </div>
        {quote.latestRequestAt && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 sm:col-span-2 lg:col-span-4 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <CalendarClock className="size-4 shrink-0" />
            <span>
              Employee requested early settlement on{" "}
              {formatDate(quote.latestRequestAt)}. Confirm the payment to
              settle.
            </span>
          </div>
        )}
      </CardContent>

      {history.length > 0 && (
        <CardContent className="border-t pt-4">
          <RestructureHistoryTable history={history} />
        </CardContent>
      )}
    </Card>
  );
}

export function RestructureHistoryTable({
  history,
}: {
  history: RestructureHistoryEntry[];
}) {
  if (history.length === 0) return null;

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <History className="size-4" />
        Restructure history
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Months</TableHead>
              <TableHead className="text-right">Instalment</TableHead>
              <TableHead>First due</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={`${entry.version}-${entry.at}`}>
                <TableCell>
                  <Badge variant="secondary">v{entry.version}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(entry.at)}
                </TableCell>
                <TableCell className="text-sm">
                  {MODE_LABELS[entry.mode] ?? entry.mode}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {entry.months}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {naira(entry.installment)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(entry.startDate)}
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                  {entry.note || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
