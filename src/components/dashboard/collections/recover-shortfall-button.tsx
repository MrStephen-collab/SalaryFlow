"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recoverShortfall } from "@/app/dashboard/collections/actions";
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
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RecoverShortfallButton({
  deductionId,
  shortfall,
  employeeName,
}: {
  deductionId: string;
  shortfall: number;
  employeeName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(shortfall);
  const [note, setNote] = useState("");

  const handleRecover = () => {
    if (amount <= 0) {
      toast.error("Recovery amount must be greater than 0");
      return;
    }
    startTransition(async () => {
      const result = await recoverShortfall(deductionId, amount, note || undefined);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <HandCoins className="size-4" />
            Recover
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recover shortfall</DialogTitle>
          <DialogDescription>
            Record an additional amount collected from {employeeName}. Current
            shortfall: {naira(shortfall)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="recovery-amount">Amount recovered (₦)</Label>
            <Input
              id="recovery-amount"
              type="number"
              min={0}
              max={shortfall}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-note">Note (optional)</Label>
            <Input
              id="recovery-note"
              placeholder="e.g. balance paid by bank transfer"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRecover} disabled={isPending || amount <= 0}>
            {isPending ? "Recording..." : "Record recovery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
