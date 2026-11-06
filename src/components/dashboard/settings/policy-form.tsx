"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { updateOrganizationSettings } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { OrganizationSettings } from "@/types/database";

export function PolicyForm({ settings }: { settings: OrganizationSettings | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    withdrawals_enabled: settings?.withdrawals_enabled ?? false,
    thrift_interest_rate: Number(settings?.thrift_interest_rate ?? 5),
    savings_min_membership_months:
      settings?.savings_min_membership_months ?? 6,
    member_loan_multiplier: settings?.member_loan_multiplier ?? 2,
    member_savings_withdrawals_enabled:
      settings?.member_savings_withdrawals_enabled ?? true,
  });

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K] | null
  ) =>
    setForm((prev) => ({
      ...prev,
      [key]: value ?? prev[key],
    }));

  const onSubmit = () => {
    startTransition(async () => {
      const result = await updateOrganizationSettings(form);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Settings saved");
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee &amp; Member Policies</CardTitle>
        <CardDescription>
          Withdrawal and member rules. Loan interest, fees, tenure, guarantor and
          collateral are configured per loan product on the{" "}
          <Link href="/dashboard/loans" className="font-medium text-primary underline underline-offset-2">
            Loans page
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Withdrawals Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Allow employees to request withdrawals from their wallet
              </p>
            </div>
            <Switch
              checked={form.withdrawals_enabled}
              onCheckedChange={(v) => set("withdrawals_enabled", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Thrift Interest Rate (% per year)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.thrift_interest_rate}
              onChange={(e) =>
                set("thrift_interest_rate", Number(e.target.value))
              }
            />
            <p className="text-xs text-muted-foreground">
              Monthly interest credited to employee thrift savings, calculated
              on the opening balance × rate × days in month ÷ 365.
            </p>
          </div>

          <div className="pt-2 sm:col-span-2">
            <h3 className="text-sm font-semibold">External members</h3>
            <p className="text-xs text-muted-foreground">
              Membership rules for non-employees. Loan terms (interest, fees,
              duration, collateral) live on the{" "}
              <span className="font-medium text-foreground">Member Savings Loan</span>{" "}
              product.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Membership Before Loan (Months)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={form.savings_min_membership_months}
              onChange={(e) =>
                set("savings_min_membership_months", Number(e.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Loan Multiple of Savings</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step="0.5"
              value={form.member_loan_multiplier}
              onChange={(e) =>
                set("member_loan_multiplier", Number(e.target.value))
              }
            />
            <p className="text-xs text-muted-foreground">
              A member can borrow up to savings × this multiple.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Member Savings Withdrawals</Label>
              <p className="text-xs text-muted-foreground">
                Allow members to withdraw from their wallet
              </p>
            </div>
            <Switch
              checked={form.member_savings_withdrawals_enabled}
              onCheckedChange={(v) =>
                set("member_savings_withdrawals_enabled", v)
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? "Saving..." : "Save Policies"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
