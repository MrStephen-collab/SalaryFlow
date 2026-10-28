"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPlan } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  max_employees: number;
  max_branches: number;
  max_active_loans: number;
  price_monthly: number;
  price_annually: number;
  active: boolean;
};

export function CreatePlanForm({
  onCreated,
}: {
  onCreated: (plan: Plan) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    description: "",
    max_employees: "50",
    max_branches: "1",
    max_active_loans: "100",
    price_monthly: "0",
    price_annually: "0",
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
    if (!form.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    startTransition(async () => {
      const result = await createPlan({
        ...form,
        description: form.description.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setForm({
          name: "",
          description: "",
          max_employees: "50",
          max_branches: "1",
          max_active_loans: "100",
          price_monthly: "0",
          price_annually: "0",
        });
        onCreated({
          id: crypto.randomUUID(),
          name: form.name,
          description: form.description.trim() || null,
          max_employees: Number(form.max_employees),
          max_branches: Number(form.max_branches),
          max_active_loans: Number(form.max_active_loans),
          price_monthly: Number(form.price_monthly),
          price_annually: Number(form.price_annually),
          active: true,
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Plan Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Enterprise"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="For large organizations"
            />
          </div>
          <div className="space-y-2">
            <Label>Max Employees</Label>
            <Input
              type="number"
              value={form.max_employees}
              onChange={(e) => set("max_employees", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Branches</Label>
            <Input
              type="number"
              value={form.max_branches}
              onChange={(e) => set("max_branches", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Active Loans</Label>
            <Input
              type="number"
              value={form.max_active_loans}
              onChange={(e) => set("max_active_loans", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Price Monthly (NGN)</Label>
            <Input
              type="number"
              value={form.price_monthly}
              onChange={(e) => set("price_monthly", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label>Price Annually (NGN)</Label>
            <Input
              type="number"
              value={form.price_annually}
              onChange={(e) => set("price_annually", e.target.value)}
            />
          </div>
        </div>
        <div className={cn("mt-4")} />
        <div className="mt-4 flex justify-end">
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? "Creating..." : "Create Plan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}