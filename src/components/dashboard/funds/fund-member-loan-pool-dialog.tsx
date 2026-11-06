"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startMemberLoanPoolFunding } from "@/app/dashboard/funds/actions";
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
import { ExternalLink, HandCoins } from "lucide-react";

const PRESETS = [100_000, 250_000, 500_000, 1_000_000];

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FundMemberLoanPoolDialog({
  gatewayReady,
}: {
  gatewayReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");

  const numericAmount = Number(amount.replace(/,/g, ""));

  const handleSubmit = () => {
    if (!Number.isFinite(numericAmount) || numericAmount < 1000) {
      toast.error("Enter at least ₦1,000");
      return;
    }

    startTransition(async () => {
      const result = await startMemberLoanPoolFunding(numericAmount);
      if (!result.ok || !result.authorizationUrl) {
        toast.error(result.error ?? "Could not start the payment");
        return;
      }
      toast.success("Redirecting to the secure payment page…");
      window.location.assign(result.authorizationUrl);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <HandCoins className="size-4" />
            Fund Member Loan Pool
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Member Loan Pool</DialogTitle>
          <DialogDescription>
            Add money to the dedicated pool used when disbursing member loans.
            If the pool does not exist yet, it is created automatically.
          </DialogDescription>
        </DialogHeader>

        {!gatewayReady ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Online funding is not switched on yet. Add the payment gateway keys
            (<code className="font-mono text-xs">PAYSTACK_SECRET_KEY</code>,{" "}
            <code className="font-mono text-xs">PAYMENT_PROVIDER=paystack</code>)
            to this deployment to enable it.
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
                placeholder="e.g. 500000"
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
              This pool is used only for member loan disbursements. Employee
              loans use the Thrift Pool.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {gatewayReady ? "Cancel" : "Close"}
          </Button>
          {gatewayReady ? (
            <Button
              onClick={handleSubmit}
              disabled={isPending || numericAmount < 1000}
            >
              {isPending ? "Starting…" : "Continue to payment"}
              <ExternalLink className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => router.refresh()}>Refresh</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
