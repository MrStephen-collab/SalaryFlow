"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { processDeduction } from "@/app/dashboard/deductions/actions";
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
import { BadgeCheck, CheckCircle2 } from "lucide-react";

export function ProcessDeductionButton({
  deductionId,
  status,
}: {
  deductionId: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actualAmount, setActualAmount] = useState(0);

  if (status === "PROCESSED") {
    return null;
  }

  const handleProcess = () => {
    if (actualAmount <= 0) {
      toast.error("Deducted amount must be greater than 0");
      return;
    }
    startTransition(async () => {
      const result = await processDeduction(deductionId, actualAmount);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setOpen(false);
        setActualAmount(0);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <BadgeCheck className="size-4" />
            Process
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process Deduction</DialogTitle>
          <DialogDescription>
            Record the actual deducted amount for this repayment. If less than
            expected, the shortfall is tracked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Actual Deducted Amount (₦)</Label>
            <Input
              type="number"
              value={actualAmount}
              onChange={(e) => setActualAmount(Number(e.target.value))}
              min={0}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={isPending || actualAmount <= 0}
          >
            <CheckCircle2 className="size-4" />
            {isPending ? "Processing..." : "Process Deduction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}