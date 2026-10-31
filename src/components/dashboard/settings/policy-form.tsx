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
    salary_payment_day: settings?.salary_payment_day ?? 25,
    auto_disburse_salaries: settings?.auto_disburse_salaries ?? false,
    savings_min_membership_months:
      settings?.savings_min_membership_months ?? 6,
    member_loan_multiplier: settings?.member_loan_multiplier ?? 2,
    member_loan_interest_rate: settings?.member_loan_interest_rate ?? 1,
    member_loan_collateral_required:
      settings?.member_loan_collateral_required ?? false,
    member_loan_processing_fee_percentage:
      settings?.member_loan_processing_fee_percentage ?? 0,
    member_loan_duration_months: settings?.member_loan_duration_months ?? 6,
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
            <p className="text-xs text-muted-foreground">
              Months an employee must have worked before loan eligibility. 12
              months = 1 year. Set 0 to allow new employees.
            </p>
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

          <div className="pt-2 sm:col-span-2">
            <h3 className="text-sm font-semibold">Payroll automation</h3>
            <p className="text-xs text-muted-foreground">
              Fund your salary pool online, then have salaries paid into employee
              wallets automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Salary Payment Day</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={form.salary_payment_day}
              onChange={(e) =>
                set("salary_payment_day", Number(e.target.value))
              }
            />
            <p className="text-xs text-muted-foreground">
              Day of the month (1-28) salaries leave the pool.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Automatic Salary Payment</Label>
              <p className="text-xs text-muted-foreground">
                Pay due salary periods without manual approval
              </p>
            </div>
            <Switch
              checked={form.auto_disburse_salaries}
              onCheckedChange={(v) => set("auto_disburse_salaries", v)}
            />
          </div>

          <div className="pt-2 sm:col-span-2">
            <h3 className="text-sm font-semibold">External members</h3>
            <p className="text-xs text-muted-foreground">
              Rules for non-employees who save with your organization and later
              borrow against their savings.
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

          <div className="space-y-2">
            <Label>Member Loan Interest (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.member_loan_interest_rate}
              onChange={(e) =>
                set("member_loan_interest_rate", Number(e.target.value))
              }
            />
            <p className="text-xs text-muted-foreground">
              Flat interest on the loan. 1% = 10 naira on every 1,000.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Member Loan Processing Fee (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.member_loan_processing_fee_percentage}
              onChange={(e) =>
                set(
                  "member_loan_processing_fee_percentage",
                  Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Added to the member&apos;s total repayment.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Member Loan Duration (Months)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={form.member_loan_duration_months}
              onChange={(e) =>
                set("member_loan_duration_months", Number(e.target.value))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Require Loan Collateral</Label>
              <p className="text-xs text-muted-foreground">
                Members must submit collateral details and a document before the
                loan can be approved.
              </p>
            </div>
            <Switch
              checked={form.member_loan_collateral_required}
              onCheckedChange={(v) =>
                set("member_loan_collateral_required", v)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Member Savings Withdrawals</Label>
              <p className="text-xs text-muted-foreground">
                Allow members to withdraw their own savings
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