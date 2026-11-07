"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startSubscriptionPayment } from "@/app/dashboard/settings/subscription-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import type { SubscriptionPlanRecord } from "@/services/subscription-service";

function naira(amount: number) {
  return amount.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  });
}

export function SubscriptionPlans({
  plans,
  currentPlanId,
  currentStatus,
}: {
  plans: SubscriptionPlanRecord[];
  currentPlanId?: string;
  currentStatus?: string;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">(
    "monthly"
  );
  const [isPending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  function subscribe(plan: SubscriptionPlanRecord) {
    const amount =
      billingCycle === "annually" ? plan.price_annually : plan.price_monthly;
    if (amount <= 0) {
      toast.error("This plan has no price set. Contact the platform owner.");
      return;
    }

    setPendingPlan(plan.id);
    startTransition(async () => {
      const result = await startSubscriptionPayment(plan.id, billingCycle);
      if (!result.ok || !result.authorizationUrl) {
        toast.error(result.error ?? "Could not start the subscription payment");
        setPendingPlan(null);
        return;
      }
      window.location.assign(result.authorizationUrl);
    });
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">No subscription plans available</p>
          <p className="text-sm text-muted-foreground">
            The platform owner has not published a plan yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit rounded-lg border p-1">
        {(["monthly", "annually"] as const).map((cycle) => (
          <Button
            key={cycle}
            type="button"
            size="sm"
            variant={billingCycle === cycle ? "default" : "ghost"}
            onClick={() => setBillingCycle(cycle)}
          >
            {cycle === "monthly" ? "Monthly" : "Annually"}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const amount =
            billingCycle === "annually"
              ? plan.price_annually
              : plan.price_monthly;
          const isCurrent =
            currentPlanId === plan.id && currentStatus === "active";
          const isThisPending =
            isPending && pendingPlan === plan.id;

          return (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <CardDescription>
                      {plan.description || "Subscription plan"}
                    </CardDescription>
                  </div>
                  {isCurrent ? <Badge>Current</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <p className="text-2xl font-bold">
                    {naira(amount)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      /{billingCycle === "annually" ? "year" : "month"}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center text-sm">
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
                    <p className="mt-1 font-semibold">
                      {plan.max_active_loans}
                    </p>
                  </div>
                </div>

                <Button
                  className="mt-auto"
                  onClick={() => subscribe(plan)}
                  disabled={isPending || amount <= 0}
                >
                  {isThisPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {isThisPending
                    ? "Starting payment…"
                    : isCurrent
                      ? "Renew plan"
                      : "Choose plan"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
