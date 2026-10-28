"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { organizationSchema, organizationSettingsSchema, CURRENCIES, SALARY_CYCLES, APPROVAL_WORKFLOWS } from "@/schemas/settings";
import { INTEREST_METHODS } from "@/schemas/loan";
import { ORGANIZATION_TYPES } from "@/config/constants";

const STEPS = ["Organization", "Loan Policies", "Review"] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [organization, setOrganization] = useState({
    name: "",
    type: "Company",
    registrationNumber: "",
    email: "",
    phone: "",
    address: "",
    state: "",
    lga: "",
    currency: "NGN",
  });

  const [settings, setSettings] = useState({
    salary_cycle: "monthly",
    max_salary_deduction_percentage: "30",
    min_salary: "0",
    min_employment_period_months: "0",
    max_loan_amount: "",
    default_interest_rate: "",
    default_interest_method: "FLAT",
    max_tenure: "12",
    guarantor_required: false,
    approval_workflow: "two_level",
    withdrawals_enabled: false,
  });

  const setOrg = <K extends keyof typeof organization>(
    key: K,
    value: (typeof organization)[K] | null
  ) =>
    setOrganization((prev) => ({
      ...prev,
      [key]: value ?? prev[key],
    }));

  const setSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K] | null
  ) =>
    setSettings((prev) => ({
      ...prev,
      [key]: value ?? prev[key],
    }));

  const validateStep = useMemo(
    () => (step: number) => {
      if (step === 0) {
        const result = organizationSchema.safeParse({
          ...organization,
          registrationNumber: organization.registrationNumber || undefined,
          address: organization.address || undefined,
          state: organization.state || undefined,
          lga: organization.lga || undefined,
        });
        if (!result.success) {
          setError(result.error.issues[0]?.message ?? "Invalid organization details");
          return false;
        }
      }
      if (step === 1) {
        const result = organizationSettingsSchema.safeParse(settings);
        if (!result.success) {
          setError(result.error.issues[0]?.message ?? "Invalid settings");
          return false;
        }
      }
      setError(null);
      return true;
    },
    [organization, settings]
  );

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = () => {
    if (!validateStep(1)) return;
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        organization: {
          ...organization,
          registrationNumber: organization.registrationNumber || undefined,
          address: organization.address || undefined,
          state: organization.state || undefined,
          lga: organization.lga || undefined,
        },
        settings,
      });
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        toast.success(result.success);
        router.refresh();
      }
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Set up your organization</CardTitle>
        <CardDescription>
          Tell us about your organization and loan policies to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col gap-1.5">
              <div
                className={
                  "h-1 rounded-full " +
                  (i <= step ? "bg-primary" : "bg-muted")
                }
              />
              <span
                className={
                  "text-xs " +
                  (i <= step ? "text-foreground" : "text-muted-foreground")
                }
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Organization Name *</Label>
              <Input
                value={organization.name}
                onChange={(e) => setOrg("name", e.target.value)}
                placeholder="e.g. Acme Ltd"
              />
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={organization.type}
                onValueChange={(v) => setOrg("type", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Currency *</Label>
              <Select
                value={organization.currency}
                onValueChange={(v) => setOrg("currency", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={organization.email}
                onChange={(e) => setOrg("email", e.target.value)}
                placeholder="info@acme.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={organization.phone}
                onChange={(e) => setOrg("phone", e.target.value)}
                placeholder="+234 800 000 0000"
              />
            </div>

            <div className="space-y-2">
              <Label>Registration Number</Label>
              <Input
                value={organization.registrationNumber}
                onChange={(e) => setOrg("registrationNumber", e.target.value)}
                placeholder="e.g. RC 1234567"
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={organization.state}
                onChange={(e) => setOrg("state", e.target.value)}
                placeholder="Lagos"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={organization.address}
                onChange={(e) => setOrg("address", e.target.value)}
                placeholder="Street address"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Salary Cycle</Label>
              <Select
                value={settings.salary_cycle}
                onValueChange={(v) => setSetting("salary_cycle", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_CYCLES.map((cycle) => (
                    <SelectItem key={cycle} value={cycle}>
                      {cycle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Deduction (%)</Label>
              <Input
                type="number"
                value={settings.max_salary_deduction_percentage}
                onChange={(e) =>
                  setSetting("max_salary_deduction_percentage", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Min Salary (NGN)</Label>
              <Input
                type="number"
                value={settings.min_salary}
                onChange={(e) => setSetting("min_salary", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Min Employment (months)</Label>
              <Input
                type="number"
                value={settings.min_employment_period_months}
                onChange={(e) =>
                  setSetting("min_employment_period_months", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max Loan Amount (NGN)</Label>
              <Input
                type="number"
                value={settings.max_loan_amount}
                onChange={(e) => setSetting("max_loan_amount", e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Default Interest Rate (%)</Label>
              <Input
                type="number"
                value={settings.default_interest_rate}
                onChange={(e) => setSetting("default_interest_rate", e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Interest Method</Label>
              <Select
                value={settings.default_interest_method}
                onValueChange={(v) => setSetting("default_interest_method", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Tenure (months)</Label>
              <Input
                type="number"
                value={settings.max_tenure}
                onChange={(e) => setSetting("max_tenure", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Approval Workflow</Label>
              <Select
                value={settings.approval_workflow}
                onValueChange={(v) => setSetting("approval_workflow", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_WORKFLOWS.map((workflow) => (
                    <SelectItem key={workflow} value={workflow}>
                      {workflow}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Require guarantor</p>
                <p className="text-xs text-muted-foreground">
                  Employees must provide a guarantor for loans
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={settings.guarantor_required}
                onChange={(e) => setSetting("guarantor_required", e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enable withdrawals</p>
                <p className="text-xs text-muted-foreground">
                  Allow employees to request payroll advances
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={settings.withdrawals_enabled}
                onChange={(e) => setSetting("withdrawals_enabled", e.target.checked)}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Organization</span>
              <span className="col-span-2 font-medium">{organization.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Type</span>
              <span className="col-span-2 font-medium">{organization.type}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Email</span>
              <span className="col-span-2 font-medium">{organization.email}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Phone</span>
              <span className="col-span-2 font-medium">{organization.phone}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Currency</span>
              <span className="col-span-2 font-medium">{organization.currency}</span>
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Salary Cycle</span>
              <span className="col-span-2 font-medium capitalize">
                {settings.salary_cycle}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Max Deduction</span>
              <span className="col-span-2 font-medium">
                {settings.max_salary_deduction_percentage}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Min Salary</span>
              <span className="col-span-2 font-medium">
                ₦{Number(settings.min_salary).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Max Tenure</span>
              <span className="col-span-2 font-medium">
                {settings.max_tenure} months
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Guarantor</span>
              <span className="col-span-2 font-medium">
                {settings.guarantor_required ? "Required" : "Not required"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Withdrawals</span>
              <span className="col-span-2 font-medium">
                {settings.withdrawals_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={back} disabled={step === 0 || isPending}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={onSubmit} disabled={isPending}>
              {isPending ? "Creating organization..." : "Create Organization"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}