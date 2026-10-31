"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestMemberWithdrawal } from "@/app/member/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function MemberWithdrawalForm({ max }: { max: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (value > max) {
      toast.error(`You can withdraw up to ${naira(max)}`);
      return;
    }

    startTransition(async () => {
      const result = await requestMemberWithdrawal(value);
      if (!result.ok) {
        toast.error(result.error ?? "Could not submit the request");
        return;
      }
      toast.success(result.success ?? "Withdrawal request submitted");
      setAmount("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Amount (₦) *</Label>
        <Input
          type="number"
          min={1}
          max={max}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={`Up to ${naira(max)}`}
        />
        <p className="text-xs text-muted-foreground">
          Requests are approved by the chairman before payment.
        </p>
      </div>
      <Button onClick={submit} disabled={isPending || max <= 0}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {isPending ? "Submitting…" : "Request withdrawal"}
      </Button>
    </div>
  );
}
