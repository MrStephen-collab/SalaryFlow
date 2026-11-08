"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { postThriftInterest, recalculateThriftInterest } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Percent } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ThriftInterestControls({
  periodMonth,
  annualRate,
  closed,
  postedCount,
  canPost,
}: {
  periodMonth: string;
  annualRate: number;
  closed: boolean;
  postedCount: number;
  canPost: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeMonth(value: string) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("interestMonth", value);
    router.push(`/dashboard/employees/thrift?${params.toString()}`);
  }

  function post() {
    startTransition(async () => {
      const result = await postThriftInterest(periodMonth);
      if (!result.ok) {
        toast.error(result.error ?? "Could not post thrift interest");
        return;
      }
      toast.success(
        `${result.posted} employee${result.posted === 1 ? "" : "s"} credited · ${naira(
          result.total ?? 0
        )} interest${result.skipped ? ` · ${result.skipped} skipped` : ""}`
      );
      if (result.failed) {
        toast.warning(
          `${result.failed} employee${result.failed === 1 ? "" : "s"} could not be posted`
        );
      }
      router.refresh();
    });
  }

  function recalculate() {
    startTransition(async () => {
      const result = await recalculateThriftInterest(periodMonth);
      if (!result.ok) {
        toast.error(result.error ?? "Could not recalculate thrift interest");
        return;
      }
      toast.success(
        `${result.posted} employee${result.posted === 1 ? "" : "s"} reposted · ${naira(
          result.total
        )} interest · ${result.reversed} reversed`
      );
      if (result.failures.length > 0) {
        toast.warning(
          `${result.failures.length} month${result.failures.length === 1 ? "" : "s"} could not be fully recalculated`
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label
          htmlFor="interestMonth"
          className="text-xs font-medium text-muted-foreground"
        >
          Interest month
        </label>
        <Input
          id="interestMonth"
          type="month"
          className="w-[170px]"
          value={periodMonth.slice(0, 7)}
          onChange={(event) => changeMonth(event.target.value)}
        />
      </div>
      {canPost ? (
        <>
          <ConfirmDialog
            trigger={
              <Button disabled={!closed || isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Percent className="size-4" />
                )}
                {isPending ? "Posting…" : "Post interest"}
              </Button>
            }
            title={`Post interest for ${periodMonth.slice(0, 7)}?`}
            description={`Interest will be calculated at ${annualRate}% per annum on each employee's opening balance × eligible days ÷ 365 and credited to their thrift savings. Employees already posted are skipped.`}
            confirmLabel="Post interest"
            onConfirm={post}
          />
          {postedCount > 0 ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Recalculate
                </Button>
              }
              title={`Recalculate interest from ${periodMonth.slice(0, 7)}?`}
              description="This reverses and reposts interest from the selected month through the latest completed month. Use it after importing or correcting prior thrift savings so every later month uses the corrected balance."
              confirmLabel="Recalculate interest"
              onConfirm={recalculate}
            />
          ) : null}
        </>
      ) : null}
      <p className="w-full text-xs text-muted-foreground">
        {!closed
          ? "Interest can only be posted for a completed month."
          : postedCount > 0
            ? `${postedCount} employee${postedCount === 1 ? "" : "s"} already have interest posted for this month. Posting again skips them.`
            : "No interest has been posted for this month yet."}
      </p>
    </div>
  );
}
