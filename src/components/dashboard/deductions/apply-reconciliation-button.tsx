"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyPayrollReconciliation } from "@/app/dashboard/deductions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ApplyReconciliationButton({
  periodId,
  employees,
  total,
}: {
  periodId: string;
  employees: number;
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleApply = () => {
    startTransition(async () => {
      const result = await applyPayrollReconciliation(periodId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={employees === 0 || total <= 0}>
            <CheckCircle2 className="size-4" />
            Post to loans
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post reconciliation</DialogTitle>
          <DialogDescription>
            Record the reconciled deductions against loan schedules, repayment
            history and the ledger. This cannot be undone from here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 text-sm">
          <div className="flex justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-muted-foreground">Employees</span>
            <span className="font-medium">{employees}</span>
          </div>
          <div className="flex justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-muted-foreground">Amount to post</span>
            <span className="font-medium">{naira(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Already processed deductions and employees with no reported amount
            are skipped.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isPending}>
            {isPending ? "Posting..." : "Post deductions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
