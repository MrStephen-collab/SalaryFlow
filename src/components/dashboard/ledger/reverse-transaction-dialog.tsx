"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reverseLedgerTransaction } from "@/app/dashboard/ledger/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Undo2 } from "lucide-react";

export function ReverseTransactionDialog({
  transactionId,
}: {
  transactionId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  const handleReverse = () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the reversal");
      return;
    }
    startTransition(async () => {
      const result = await reverseLedgerTransaction(transactionId, reason.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive">
            <Undo2 className="size-4" />
            Reverse
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse Transaction</DialogTitle>
          <DialogDescription>
            This creates a mirror reversal entry. The original transaction is
            kept for audit purposes. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this transaction is being reversed..."
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReverse}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? "Reversing..." : "Confirm Reversal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
