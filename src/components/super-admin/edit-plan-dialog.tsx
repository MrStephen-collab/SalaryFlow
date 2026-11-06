"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updatePlan } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

export type Plan = {
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

function defaults(plan: Plan) {
  return {
    name: plan.name,
    description: plan.description ?? "",
    max_employees: String(plan.max_employees),
    max_branches: String(plan.max_branches),
    max_active_loans: String(plan.max_active_loans),
    price_monthly: String(plan.price_monthly),
    price_annually: String(plan.price_annually),
  };
}

export function EditPlanDialog({
  plan,
  onUpdated,
}: {
  plan: Plan;
  onUpdated?: (plan: Plan) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(() => defaults(plan));

  function set<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (next) setForm(defaults(plan));
    setOpen(next);
  }

  function save() {
    if (!form.name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    startTransition(async () => {
      const result = await updatePlan(plan.id, {
        ...form,
        description: form.description.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      if (result.plan) onUpdated?.(result.plan);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Plan</DialogTitle>
          <DialogDescription>
            Update the limits and pricing for {plan.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Plan Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Employees</Label>
            <Input
              type="number"
              min={1}
              value={form.max_employees}
              onChange={(e) => set("max_employees", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Branches</Label>
            <Input
              type="number"
              min={1}
              value={form.max_branches}
              onChange={(e) => set("max_branches", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Active Loans</Label>
            <Input
              type="number"
              min={1}
              value={form.max_active_loans}
              onChange={(e) => set("max_active_loans", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Price Monthly (NGN)</Label>
            <Input
              type="number"
              min={0}
              value={form.price_monthly}
              onChange={(e) => set("price_monthly", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Price Annually (NGN)</Label>
            <Input
              type="number"
              min={0}
              value={form.price_annually}
              onChange={(e) => set("price_annually", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
