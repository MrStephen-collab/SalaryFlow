"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyMemberLoan } from "@/app/member/actions";
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
import { HandCoins } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ApplyLoanDialog({
  maxLoan,
  eligible,
  monthsRemaining,
  hasActiveLoan,
}: {
  maxLoan: number;
  eligible: boolean;
  monthsRemaining: number;
  hasActiveLoan: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");

  const numericAmount = Number(amount.replace(/,/g, ""));
  const blocked = !eligible || hasActiveLoan || maxLoan <= 0;

  function handleSubmit() {
    if (!Number.isFinite(numericAmount) || numericAmount < 1000) {
      toast.error("Enter at least ₦1,000");
      return;
    }
    if (numericAmount > maxLoan) {
      toast.error(`Your maximum loan is ${naira(maxLoan)}`);
      return;
    }

    startTransition(async () => {
      const result = await applyMemberLoan(numericAmount, purpose);
      if (!result.ok) {
        toast.error(result.error ?? "Could not submit your application");
        return;
      }
      toast.success(result.success ?? "Loan application submitted");
      setOpen(false);
      setAmount("");
      setPurpose("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={blocked}>
            <HandCoins className="size-4" />
            Apply for Loan
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for a Loan</DialogTitle>
          <DialogDescription>
            Your limit is based on your own savings. You can borrow up to{" "}
            {naira(maxLoan)}.
          </DialogDescription>
        </DialogHeader>

        {monthsRemaining > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            You can apply after {monthsRemaining} more month(s) of active
            membership.
          </div>
        ) : hasActiveLoan ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            You already have a loan in progress. Repay it before applying again.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1000}
                max={maxLoan}
                step={500}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={`Up to ${naira(maxLoan)}`}
              />
            </div>
            <div className="space-y-2">
              <Label>What is the loan for?</Label>
              <Input
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="e.g. School fees"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your request is reviewed by the organization. Once approved, the
              loan is credited to your savings wallet.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || blocked || numericAmount < 1000}
          >
            {isPending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
