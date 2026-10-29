"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { paySalaryPeriod } from "@/app/dashboard/salary/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BanknoteIcon } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PayPeriodButton({
  periodId,
  periodName,
  netPayable,
  poolBalance,
  alreadyPaid,
}: {
  periodId: string;
  periodName: string;
  netPayable: number;
  poolBalance: number;
  alreadyPaid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shortfall = netPayable - poolBalance;
  const canPay = netPayable > 0 && shortfall <= 0;

  const handlePay = () => {
    startTransition(async () => {
      const result = await paySalaryPeriod(periodId);
      if (!result.ok) {
        toast.error(result.error ?? "Payroll could not be completed");
      } else {
        toast.success(result.message ?? "Salaries paid to employee wallets");
        setOpen(false);
      }
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={alreadyPaid}>
            <BanknoteIcon className="size-4" />
            {alreadyPaid ? "Salaries paid" : "Pay salaries now"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {periodName}</DialogTitle>
          <DialogDescription>
            {naira(netPayable)} will be moved from your salary pool into{" "}
            employee wallets. Employees can then withdraw to their bank accounts.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Salary pool</span>
            <span className="font-mono">{naira(poolBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net payable</span>
            <span className="font-mono">{naira(netPayable)}</span>
          </div>
          {shortfall > 0 ? (
            <div className="flex justify-between font-medium text-destructive">
              <span>Shortfall</span>
              <span className="font-mono">{naira(shortfall)}</span>
            </div>
          ) : null}
        </div>

        {shortfall > 0 ? (
          <p className="text-sm text-destructive">
            Fund the salary pool with at least {naira(shortfall)} before running
            payroll.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={!canPay || isPending}>
            {isPending ? "Paying…" : "Confirm payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
