"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { fundAllThrift } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Loader2, PiggyBank } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ThriftFundingControls({
  periodMonth,
  disabled = false,
}: {
  periodMonth: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeMonth(value: string) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", value);
    router.push(`/dashboard/employees/thrift?${params.toString()}`);
  }

  function fundAll() {
    startTransition(async () => {
      const result = await fundAllThrift(periodMonth);
      if (!result.ok) {
        toast.error(result.error ?? "Could not fund thrift savings");
        return;
      }
      toast.success(
        `${result.funded ?? 0} employee${
          result.funded === 1 ? "" : "s"
        } funded${
          result.skipped ? ` · ${result.skipped} already funded` : ""
        } · ${naira(result.total ?? 0)} total`
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label
          htmlFor="thriftMonth"
          className="text-xs font-medium text-muted-foreground"
        >
          Funding month
        </label>
        <Input
          id="thriftMonth"
          type="month"
          className="w-[170px]"
          value={periodMonth.slice(0, 7)}
          onChange={(event) => changeMonth(event.target.value)}
        />
      </div>
      <ConfirmDialog
        trigger={
          <Button disabled={isPending || disabled}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PiggyBank className="size-4" />
            )}
            {isPending ? "Funding…" : "Fund All Employees (Corporate)"}
          </Button>
        }
        title="Fund every eligible employee?"
        description="The agreed monthly thrift will be recorded for every eligible employee who has not been funded this month. Employees already funded are skipped. This cannot be undone from the app."
        confirmLabel="Fund all"
        onConfirm={fundAll}
      />
      {disabled ? (
        <p className="w-full text-xs text-muted-foreground">
          All eligible employees are already funded for this month.
        </p>
      ) : null}
    </div>
  );
}
