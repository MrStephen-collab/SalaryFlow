"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startSavingsDeposit } from "@/app/member/actions";
import { Button } from "@/components/ui/button";
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
import { CreditCard, ExternalLink } from "lucide-react";

const PRESETS = [5_000, 10_000, 25_000, 50_000, 100_000];

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DepositDialog({ gatewayReady }: { gatewayReady: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");

  const numericAmount = Number(amount.replace(/,/g, ""));

  function handleSubmit() {
    if (!Number.isFinite(numericAmount) || numericAmount < 1000) {
      toast.error("Enter at least ₦1,000");
      return;
    }

    startTransition(async () => {
      const result = await startSavingsDeposit(numericAmount);
      if (!result.ok || !result.authorizationUrl) {
        toast.error(result.error ?? "Could not start the payment");
        return;
      }
      toast.success("Redirecting to the secure payment page…");
      window.location.assign(result.authorizationUrl);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <CreditCard className="size-4" />
            Add Savings
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Savings</DialogTitle>
          <DialogDescription>
            Pay into your savings with card, bank transfer or USSD. Your savings
            balance updates as soon as the payment is confirmed.
          </DialogDescription>
        </DialogHeader>

        {!gatewayReady ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Online savings deposits are not switched on yet. Please contact your
            organization.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1000}
                step={500}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="e.g. 10000"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={numericAmount === preset ? "default" : "outline"}
                    onClick={() => setAmount(String(preset))}
                  >
                    {naira(preset)}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              You will be redirected to the payment provider to complete this
              payment. The deposit is credited automatically once it is confirmed.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {gatewayReady ? "Cancel" : "Close"}
          </Button>
          {gatewayReady ? (
            <Button onClick={handleSubmit} disabled={isPending || numericAmount < 1000}>
              {isPending ? "Starting…" : "Continue to payment"}
              <ExternalLink className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                setOpen(false);
                router.refresh();
              }}
            >
              Refresh
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
