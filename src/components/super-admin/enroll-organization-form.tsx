"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { enrollOrganization } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/schemas/settings";
import { ORGANIZATION_TYPES } from "@/config/constants";

type Plan = {
  id: string;
  name: string;
  max_employees: number;
};

export function EnrollOrganizationForm({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    type: ORGANIZATION_TYPES[0] as string,
    registrationNumber: "",
    email: "",
    phone: "",
    currency: "NGN" as string,
    plan_id: "",
    trial_days: "0",
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
      const result = await enrollOrganization({
        organization: {
          name: form.name,
          type: form.type,
          registrationNumber: form.registrationNumber.trim() || undefined,
          email: form.email,
          phone: form.phone,
          currency: form.currency,
        },
        plan_id: form.plan_id || undefined,
        trial_days: form.trial_days,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setForm({
          name: "",
          type: ORGANIZATION_TYPES[0] as string,
          registrationNumber: "",
          email: "",
          phone: "",
          currency: "NGN",
          plan_id: "",
          trial_days: "0",
        });
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enroll an organization</CardTitle>
        <CardDescription>
          Provision a new organization with loan settings and an optional
          subscription plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Organization Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Acme Ltd"
            />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
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
              value={form.currency}
              onValueChange={(v) => set("currency", v)}
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
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="info@acme.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="space-y-2">
            <Label>Registration Number</Label>
            <Input
              value={form.registrationNumber}
              onChange={(e) => set("registrationNumber", e.target.value)}
              placeholder="e.g. RC 1234567"
            />
          </div>
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select
              value={form.plan_id}
              onValueChange={(v) => set("plan_id", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => {
                    const selected = plans.find((p) => p.id === value);
                    return selected
                      ? `${selected.name} (${selected.max_employees} employees)`
                      : "Select a plan";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} ({plan.max_employees} employees)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Trial Days</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={form.trial_days}
              onChange={(e) => set("trial_days", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? "Enrolling..." : "Enroll Organization"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}