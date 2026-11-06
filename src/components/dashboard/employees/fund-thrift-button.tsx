"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fundThrift } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, PiggyBank } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function FundThriftButton({
  employeeId,
  periodMonth,
  amount,
  funded,
  enabled = true,
}: {
  employeeId: string;
  periodMonth: string;
  amount: number;
  funded: boolean;
  enabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (funded) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Funded
      </Button>
    );
  }

  if (!enabled || amount <= 0) {
    return (
      <Button variant="ghost" size="sm" disabled title="Thrift is switched off for this employee">
        Off
      </Button>
    );
  }

  function fund() {
    startTransition(async () => {
      const result = await fundThrift(employeeId, periodMonth, amount);
      if (!result.ok) {
        toast.error(result.error ?? "Could not fund thrift savings");
        return;
      }
      toast.success(
        `${naira(result.amount ?? amount)} funded · ${naira(
          result.loanRepayment ?? 0
        )} to loan`
      );
      if (result.warning) toast.warning(result.warning);
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PiggyBank className="size-4" />
          )}
          {isPending ? "Funding…" : "Fund"}
        </Button>
      }
      title="Fund thrift savings?"
      description={`${naira(amount)} will be recorded for this employee and applied to their active loan instalment and savings. This cannot be undone from the app.`}
      confirmLabel="Fund thrift"
      onConfirm={fund}
    />
  );
}
