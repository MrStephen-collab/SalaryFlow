"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordMemberRepayment } from "@/app/dashboard/members/actions";
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
import { HandCoins, Loader2 } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function MemberRepaymentDialog({
  applicationId,
  memberName,
  outstanding,
  monthly,
}: {
  applicationId: string;
  memberName: string;
  outstanding: number;
  monthly: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(monthly > 0 ? monthly : outstanding));
  const [isPending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid repayment amount");
      return;
    }
    if (value > outstanding) {
      toast.error(`Outstanding balance is ${naira(outstanding)}`);
      return;
    }

    startTransition(async () => {
      const result = await recordMemberRepayment(applicationId, value);
      if (!result.ok) {
        toast.error(result.error ?? "Could not record the repayment");
        return;
      }
      toast.success(
        `${naira(result.applied ?? 0)} received · ${naira(
          result.savings ?? 0
        )} added to savings`
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <HandCoins className="size-4" />
            Record repayment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record repayment</DialogTitle>
          <DialogDescription>
            {memberName} · outstanding {naira(outstanding)}. The principal
            portion becomes fresh savings; the interest portion is loan income.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Amount received (₦) *</Label>
          <Input
            type="number"
            min={1}
            max={outstanding}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Monthly instalment: {naira(monthly)}.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Recording…" : "Record repayment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
