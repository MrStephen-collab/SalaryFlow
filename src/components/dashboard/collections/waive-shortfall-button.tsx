"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { waiveShortfall } from "@/app/dashboard/collections/actions";
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
import { FileX2 } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function WaiveShortfallButton({
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
  const [reason, setReason] = useState("");

  const handleWaive = () => {
    if (!reason.trim()) {
      toast.error("A waiver reason is required");
      return;
    }
    startTransition(async () => {
      const result = await waiveShortfall(deductionId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <FileX2 className="size-4" />
            Waive
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Waive shortfall</DialogTitle>
          <DialogDescription>
            Forgive the {naira(shortfall)} shortfall for {employeeName}. This is
            an explicit, audited decision and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="waiver-reason">Reason</Label>
          <Input
            id="waiver-reason"
            placeholder="e.g. employee left the organization"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleWaive}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? "Waiving..." : "Waive shortfall"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
