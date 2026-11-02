"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestThriftRelease } from "@/app/employee/actions";
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
import { Loader2, PiggyBank } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ThriftReleaseRequest({
  balance,
  pending,
}: {
  balance: number;
  pending: { amount: number; createdAt: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [isPending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (value > balance) {
      toast.error(`You can request up to ${naira(balance)}`);
      return;
    }

    startTransition(async () => {
      const result = await requestThriftRelease(value);
      if (!result.ok) {
        toast.error(result.error ?? "Could not send the request");
        return;
      }
      toast.success(result.success ?? "Request sent");
      setOpen(false);
      router.refresh();
    });
  }

  if (pending) {
    return (
      <p className="text-xs text-muted-foreground">
        Request of {naira(pending.amount)} sent on{" "}
        {new Date(pending.createdAt).toLocaleDateString("en-NG")} — awaiting
        employer approval.
      </p>
    );
  }

  if (balance <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Thrift savings will be released by the chairman.
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <PiggyBank className="size-4" />
            Request release
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request thrift release</DialogTitle>
          <DialogDescription>
            Your employer reviews each request individually. Approved amounts are
            moved into your withdrawable wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Amount (₦) *</Label>
          <Input
            type="number"
            min={1}
            max={balance}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Available thrift: {naira(balance)}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Sending…" : "Send request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
