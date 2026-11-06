"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestEarlySettlement } from "@/app/employee/actions";
import type { SettlementQuote } from "@/services/loan-settlement-service";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, HandCoins } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function EarlySettlementCard({
  applicationId,
  quote,
}: {
  applicationId: string;
  quote: SettlementQuote;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const requested = Boolean(quote.latestRequestAt);

  const handleRequest = () => {
    startTransition(async () => {
      const result = await requestEarlySettlement(
        applicationId,
        note.trim() || undefined
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      setNote("");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Pay off this loan early</CardTitle>
          <CardDescription>
            Settle the outstanding balance and save on unearned interest.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button disabled={requested}>
                <HandCoins className="size-4" />
                {requested ? "Request sent" : "Request settlement"}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request early settlement</DialogTitle>
              <DialogDescription>
                Your employer will confirm the payment. Adding a note helps
                them find your transfer.
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
                  <span className="text-muted-foreground">Accrued interest</span>
                  <span className="font-medium">{naira(quote.accruedInterest)}</span>
                </div>
                {quote.discount > 0 && (
                  <div className="mt-1 flex justify-between text-green-600">
                    <span>Future interest waived</span>
                    <span className="font-medium">−{naira(quote.discount)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t pt-2 text-base">
                  <span className="font-semibold">Total to pay</span>
                  <span className="font-bold">{naira(quote.total)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. I will pay by bank transfer on Friday"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRequest} disabled={isPending}>
                {isPending ? "Sending..." : "Send request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Principal left</p>
            <p className="mt-1 font-semibold">
              {naira(quote.outstandingPrincipal)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Interest saved</p>
            <p className="mt-1 font-semibold text-green-600">
              {naira(quote.discount)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total to pay today</p>
            <p className="mt-1 font-semibold">{naira(quote.total)}</p>
          </div>
        </div>

        {quote.latestRequestAt && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <CalendarClock className="size-4 shrink-0" />
            <span>
              Requested on{" "}
              {new Date(quote.latestRequestAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              . Your employer will confirm the payment.
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          The quote is based on {quote.installmentsOutstanding} remaining
          instalment{quote.installmentsOutstanding === 1 ? "" : "s"} as of
          today. Final amount may change if a thrift funding repayment is posted
          in the meantime.
        </p>
      </CardContent>
    </Card>
  );
}
