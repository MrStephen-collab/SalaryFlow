"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMyThriftAmount } from "@/app/employee/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ThriftSettings({
  amount,
  balance,
  salary,
  enabled,
}: {
  amount: number;
  balance: number;
  salary: number;
  enabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(amount || 0));
  const [isPending, startTransition] = useTransition();

  const numericValue = Number(value.replace(/,/g, ""));
  const invalid = !Number.isFinite(numericValue) || numericValue < 0;
  const exceedsSalary = salary > 0 && numericValue > salary;
  const unchanged = numericValue === amount && (numericValue > 0) === enabled;

  function save() {
    if (invalid) {
      toast.error("Enter a valid thrift amount");
      return;
    }
    if (exceedsSalary) {
      toast.error(`Your thrift cannot exceed your monthly salary of ${naira(salary)}`);
      return;
    }

    startTransition(async () => {
      const result = await updateMyThriftAmount(numericValue);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update your thrift amount");
        return;
      }
      toast.success(result.success ?? "Thrift amount updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Current thrift balance</p>
          <p className="mt-1 text-lg font-semibold text-amber-600">
            {naira(balance)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Monthly salary</p>
          <p className="mt-1 text-lg font-semibold">{naira(salary)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="thriftAmount">Thrift amount per salary (₦)</Label>
        <Input
          id="thriftAmount"
          type="number"
          min={0}
          max={salary > 0 ? salary : undefined}
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. 5000"
        />
        <p className="text-xs text-muted-foreground">
          Set this to 0 to switch off thrift savings for future salary runs.
        </p>
        {exceedsSalary && (
          <p className="text-xs text-red-600">
            The amount cannot be more than your monthly salary.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        Changing this only affects future salary runs. Your current thrift
        balance ({naira(balance)}) and past salary records are not changed.
      </div>

      <Button onClick={save} disabled={isPending || invalid || exceedsSalary || unchanged}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {isPending
          ? "Saving…"
          : numericValue > 0
            ? "Save thrift amount"
            : "Switch off thrift"}
      </Button>
    </div>
  );
}
