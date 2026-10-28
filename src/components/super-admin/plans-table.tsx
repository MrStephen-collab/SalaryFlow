"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { togglePlan } from "@/app/super-admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { CreatePlanForm } from "@/components/super-admin/create-plan-form";

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

  return (
    <>
      <CreatePlanForm onCreated={handleCreated} />

      <Card>
        <CardHeader>
          <CardTitle>{plans.length} plans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Loans</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Annually</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">
                          {plan.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{plan.max_employees}</TableCell>
                  <TableCell>{plan.max_branches}</TableCell>
                  <TableCell>{plan.max_active_loans}</TableCell>
                  <TableCell>{naira(plan.price_monthly)}</TableCell>
                  <TableCell>{naira(plan.price_annually)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={plan.active}
                      disabled={isPending}
                      onCheckedChange={(checked) =>
                        handleToggle(plan.id, checked)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No plans created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}