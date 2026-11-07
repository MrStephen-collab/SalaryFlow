"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { togglePlan } from "@/app/super-admin/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreatePlanForm } from "@/components/super-admin/create-plan-form";
import { DeletePlanButton } from "@/components/super-admin/delete-plan-button";
import {
  EditPlanDialog,
  type Plan,
} from "@/components/super-admin/edit-plan-dialog";

function naira(amount: number) {
  return amount.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  });
}

export function PlansTable({ plans: initial }: { plans: Plan[] }) {
  const [plans, setPlans] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (planId: string, nextActive: boolean) => {
    startTransition(async () => {
      const result = await togglePlan(planId, nextActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId ? { ...p, active: nextActive } : p
          )
        );
      }
    });
  };

  const handleCreated = (plan: Plan) => {
    setPlans((prev) => [plan, ...prev]);
  };

  const handleUpdated = (plan: Plan) => {
    setPlans((prev) =>
      prev.map((current) => (current.id === plan.id ? plan : current))
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <CreatePlanForm onCreated={handleCreated} />

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No plans created yet</p>
            <p className="text-sm text-muted-foreground">
              Create a plan to start enrolling organizations on a subscription.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>
                    {plan.description || "No description"}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Switch
                    checked={plan.active}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      handleToggle(plan.id, checked)
                    }
                    aria-label={`Activate ${plan.name}`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {plan.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Monthly</p>
                    <p className="mt-1 text-lg font-semibold">
                      {naira(plan.price_monthly)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Annually</p>
                    <p className="mt-1 text-lg font-semibold">
                      {naira(plan.price_annually)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Employees</p>
                    <p className="mt-1 font-semibold">{plan.max_employees}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Branches</p>
                    <p className="mt-1 font-semibold">{plan.max_branches}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Loans</p>
                    <p className="mt-1 font-semibold">{plan.max_active_loans}</p>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2">
                  <Badge
                    variant={plan.active ? "default" : "secondary"}
                    className="w-fit"
                  >
                    {plan.active ? "Active plan" : "Disabled"}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <DeletePlanButton
                      planId={plan.id}
                      planName={plan.name}
                      onDeleted={() =>
                        setPlans((prev) =>
                          prev.filter((current) => current.id !== plan.id)
                        )
                      }
                    />
                    <EditPlanDialog plan={plan} onUpdated={handleUpdated} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
