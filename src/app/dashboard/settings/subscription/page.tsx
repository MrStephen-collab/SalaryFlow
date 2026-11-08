import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SubscriptionService } from "@/services/subscription-service";
import { SubscriptionPlans } from "@/components/dashboard/settings/subscription-plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CreditCard, ReceiptText } from "lucide-react";

export const metadata: Metadata = {
  title: "Subscription",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{
    payment?: string;
    reason?: string;
    amount?: string;
    ref?: string;
  }>;
}) {
  await requireUser();
  const service = await SubscriptionService.create();
  if (!service.hasAccess()) redirect("/dashboard/settings");

  const params = await searchParams;
  const [plans, current, payments] = await Promise.all([
    service.listPlans(),
    service.getCurrent(),
    service.listPayments(20),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2"
          render={<Link href="/dashboard/settings" />}
        >
          <ArrowLeft className="size-4" />
          Settings
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
          <Badge variant="outline">
            <CreditCard className="size-3" />
            Organization billing
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a plan and pay securely. Subscription payments go to the
          platform owner.
        </p>
      </div>

      {params.payment === "success" ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Subscription payment confirmed
          {params.amount ? ` (${naira(Number(params.amount))})` : ""}. Your plan
          is now active.
        </div>
      ) : null}
      {params.payment === "pending" ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          We have not received confirmation from the payment provider yet.
          Refresh this page in a moment.
          {params.reason ? ` (${params.reason})` : ""}
        </div>
      ) : null}
      {params.payment === "failed" ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {params.reason ?? "The subscription payment did not go through."}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4 text-muted-foreground" />
            Current subscription
          </CardTitle>
          <CardDescription>
            Your organization&apos;s active plan and renewal date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="mt-1 text-lg font-semibold">{current.planName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1">
                  <Badge
                    variant={
                      current.status === "active" ? "default" : "secondary"
                    }
                  >
                    {current.status}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current period</p>
                <p className="mt-1 text-sm font-medium">
                  {formatDate(current.currentPeriodStart)} –{" "}
                  {formatDate(current.currentPeriodEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Renews</p>
                <p className="mt-1 text-sm font-medium">
                  {formatDate(current.currentPeriodEnd)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No subscription plan is active yet. Choose a plan below.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Available plans</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Monthly or annual billing. Payment is handled by the platform payment
          gateway.
        </p>
        <SubscriptionPlans
          plans={plans}
          currentPlanId={current?.planId}
          currentStatus={current?.status}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
          <CardDescription>
            Subscription payments made by your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No subscription payments yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody columns={6} itemLabel="payments">
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">
                      {payment.reference}
                    </TableCell>
                    <TableCell className="text-sm">{payment.planName}</TableCell>
                    <TableCell className="text-sm capitalize">
                      {payment.billingCycle}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {naira(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "SUCCESS"
                            ? "default"
                            : payment.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleTableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
