"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganizationSettings } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { APPROVAL_WORKFLOWS, SALARY_CYCLES } from "@/schemas/settings";
import { INTEREST_METHODS } from "@/schemas/loan";
import type { OrganizationSettings } from "@/types/database";

export function PolicyForm({ settings }: { settings: OrganizationSettings | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    salary_cycle: settings?.salary_cycle ?? "monthly",
    max_salary_deduction_percentage:
      settings?.max_salary_deduction_percentage ?? 30,
    min_salary: settings?.min_salary ?? 0,
    min_employment_period_months:
      settings?.min_employment_period_months ?? 0,
    max_loan_amount: settings?.max_loan_amount ?? "",
    default_interest_rate: settings?.default_interest_rate ?? "",
    default_interest_method: settings?.default_interest_method ?? "FLAT",
    max_tenure: settings?.max_tenure ?? 12,
    guarantor_required: settings?.guarantor_required ?? false,
    approval_workflow: settings?.approval_workflow ?? "two_level",
    withdrawals_enabled: settings?.withdrawals_enabled ?? false,
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
        toast.success(result.success);
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan &amp; Salary Policies</CardTitle>
        <CardDescription>
          Default policy limits applied when employees request loans and
          deductions are generated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Salary Cycle *</Label>
            <Select
              value={form.salary_cycle}
              onValueChange={(v) => set("salary_cycle", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALARY_CYCLES.map((cycle) => (
                  <SelectItem key={cycle} value={cycle}>
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Max Deduction % of Salary *</Label>
            <Input
              type="number"
              value={form.max_salary_deduction_percentage}
              onChange={(e) =>
                set("max_salary_deduction_percentage", Number(e.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Min Salary (₦)</Label>
            <Input
              type="number"
              value={form.min_salary}
              onChange={(e) => set("min_salary", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Min Employment Period (Months)</Label>
            <Input
              type="number"
              value={form.min_employment_period_months}
              onChange={(e) =>
                set("min_employment_period_months", Number(e.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Max Loan Amount (₦)</Label>
            <Input
              type="number"
              value={form.max_loan_amount}
              onChange={(e) => set("max_loan_amount", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Interest Rate (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.default_interest_rate}
              onChange={(e) => set("default_interest_rate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Interest Method *</Label>
            <Select
              value={form.default_interest_method}
              onValueChange={(v) => set("default_interest_method", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTEREST_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method === "REDUCING_BALANCE"
                      ? "Reducing Balance"
                      : method === "FLAT"
                        ? "Flat"
                        : "Amortized"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Max Tenure (Months) *</Label>
            <Input
              type="number"
              value={form.max_tenure}
              onChange={(e) => set("max_tenure", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Approval Workflow *</Label>
            <Select
              value={form.approval_workflow}
              onValueChange={(v) => set("approval_workflow", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVAL_WORKFLOWS.map((workflow) => (
                  <SelectItem key={workflow} value={workflow}>
                    {workflow
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Guarantor Required</Label>
              <p className="text-xs text-muted-foreground">
                Employees must provide a guarantor for approvals
              </p>
            </div>
            <Switch
              checked={form.guarantor_required}
              onCheckedChange={(v) => set("guarantor_required", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Withdrawals Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Allow employees to request withdrawals from their balance
              </p>
            </div>
            <Switch
              checked={form.withdrawals_enabled}
              onCheckedChange={(v) => set("withdrawals_enabled", v)}
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