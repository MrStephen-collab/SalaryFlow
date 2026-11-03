"use server";

import { headers } from "next/headers";
import { PaymentService } from "@/services/payment-service";
import { FundService } from "@/services/fund-service";

async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function startOrganizationFunding(amount: number) {
  const base = await siteUrl();
  return PaymentService.startOrganizationFunding({
    amount,
    callbackUrl: `${base}/api/payments/callback`,
  });
}

export async function startMemberLoanPoolFunding(amount: number) {
  const base = await siteUrl();
  const funds = await FundService.create();
  const pool = await funds.getOrCreateMemberLoanPool();

  if (pool.error || !pool.id) {
    return {
      ok: false as const,
      error: pool.error ?? "Could not prepare the Member Loan Pool",
    };
  }

  return PaymentService.startOrganizationFunding({
    amount,
    callbackUrl: `${base}/api/payments/callback`,
    fundAccountId: pool.id,
  });
}

export async function listOrganizationPayments(limit?: number) {
  return PaymentService.listOrganizationPayments(limit);
}

export async function confirmOrganizationFunding(reference: string) {
  return PaymentService.settle(reference);
}
