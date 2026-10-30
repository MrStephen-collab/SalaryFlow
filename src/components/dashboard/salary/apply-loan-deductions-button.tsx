"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyPeriodLoanDeductions } from "@/app/dashboard/salary/actions";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Backfill action: post the loan deduction portion of an already-paid period to
 * employees' loans (schedule + ledger). Idempotent.
 */
export function ApplyLoanDeductionsButton({
  periodId,
}: {
  periodId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      const result = await applyPeriodLoanDeductions(periodId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not post loan deductions");
        return;
      }
      if (!result.applied) {
        toast.info("Nothing to post — loan deductions are already applied");
      } else {
        toast.success(
          `${result.applied} repayment(s) posted · ${naira(result.total ?? 0)}`
        );
      }
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={apply} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {isPending ? "Posting…" : "Apply loan deductions"}
    </Button>
  );
}
