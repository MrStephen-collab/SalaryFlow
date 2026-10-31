"use server";

import { headers } from "next/headers";
import { PaymentService } from "@/services/payment-service";
import { MemberService } from "@/services/member-service";

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

export async function startSavingsDeposit(amount: number) {
  const base = await siteUrl();
  return PaymentService.startSavingsDeposit({
    amount,
    callbackUrl: `${base}/api/payments/callback`,
  });
}

export async function getMySavings() {
  const service = await MemberService.createForStaff();
  return service.getMySummary();
}

export async function applyMemberLoan(
  amount: number,
  purpose: string,
  collateral?: { description?: string; documentUrl?: string }
) {
  const service = await MemberService.createForStaff();
  return service.applyForLoan(amount, purpose, collateral);
}

export async function listMyLoans() {
  const service = await MemberService.createForStaff();
  return service.listMyLoans();
}

export async function requestMemberWithdrawal(amount: number) {
  const service = await MemberService.createForStaff();
  return service.requestWithdrawal(amount);
}
