"use server";

import { headers } from "next/headers";
import { PaymentService } from "@/services/payment-service";

async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function startSubscriptionPayment(
  planId: string,
  billingCycle: "monthly" | "annually"
) {
  const base = await siteUrl();
  return PaymentService.startSubscriptionPayment({
    planId,
    billingCycle,
    callbackUrl: `${base}/api/payments/callback`,
  });
}
