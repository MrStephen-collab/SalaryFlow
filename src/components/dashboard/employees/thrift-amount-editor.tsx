"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateEmployeeThriftAmount } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  const decimals = rest.join("").slice(0, 2);
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");

  if (!rest.length) return normalizedWhole;
  return `${normalizedWhole || "0"}.${decimals}`;
}

/**
 * Inline number input that lets an employer change an employee's agreed
 * monthly thrift amount. Saving 0 switches thrift off for future funding.
 */
export function ThriftAmountEditor({
  employeeId,
  employeeName,
  amount,
  enabled,
  className,
}: {
  employeeId: string;
  employeeName?: string;
  amount: number;
  enabled: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const savedAmount = enabled ? amount : 0;
  const initialValue = savedAmount > 0 ? String(savedAmount) : "";
  const [value, setValue] = useState(initialValue);

  const numericValue = Number(value);
  const invalid = !Number.isFinite(numericValue) || numericValue < 0;
  const changed =
    !invalid && Math.round(numericValue * 100) / 100 !== savedAmount;

  function save() {
    if (invalid) {
      toast.error("Enter a valid thrift amount");
      return;
    }

    startTransition(async () => {
      const result = await updateEmployeeThriftAmount(employeeId, numericValue);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update the thrift amount");
        return;
      }
      toast.success(result.success ?? "Thrift amount updated");
      router.refresh();
    });
  }

  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground"
        >
          ₦
        </span>
        <input
          key={savedAmount}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={initialValue}
          onInput={(event) => {
            const next = sanitizeAmount(event.currentTarget.value);
            if (event.currentTarget.value !== next) {
              event.currentTarget.value = next;
            }
            setValue(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          aria-label={
            employeeName
              ? `Monthly thrift amount for ${employeeName}`
              : "Monthly thrift amount"
          }
          placeholder="0"
          className="h-8 w-28 min-w-0 rounded-lg border border-input bg-transparent py-1 pr-2.5 pl-5 text-right text-base tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant={changed ? "default" : "ghost"}
        onClick={save}
        disabled={isPending || invalid || !changed}
        aria-label="Save thrift amount"
        title={changed ? "Save thrift amount" : "No changes to save"}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
      </Button>
    </div>
  );
}
