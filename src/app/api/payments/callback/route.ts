import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/services/payment-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Gateway return URL. Paystack appends ?trxref=...&reference=...; Flutterwave
 * appends ?status=...&tx_ref=...&transaction_id=...
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const reference =
    params.get("reference") ?? params.get("trxref") ?? params.get("tx_ref");

  const origin = request.nextUrl.origin;

  if (!reference) {
    return NextResponse.redirect(
      new URL("/dashboard/funds?payment=failed&reason=Missing+payment+reference", origin)
    );
  }

  try {
    const result = await PaymentService.settle(reference);

    const target =
      result.purpose === "SAVINGS_DEPOSIT"
        ? "/member/savings"
        : result.purpose === "SUBSCRIPTION"
          ? "/dashboard/settings/subscription"
          : "/dashboard/funds";
    const query = new URLSearchParams({
      payment: result.ok && result.paid ? "success" : "pending",
    });
    if (result.amount) query.set("amount", String(result.amount));
    if (!result.ok && result.message) query.set("reason", result.message);
    query.set("ref", reference);

    return NextResponse.redirect(new URL(`${target}?${query.toString()}`, origin));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not confirm payment";
    const fallback = reference?.startsWith("SF-SUB")
      ? "/dashboard/settings/subscription"
      : "/dashboard/funds";
    return NextResponse.redirect(
      new URL(
        `${fallback}?payment=failed&reason=${encodeURIComponent(reason)}`,
        origin
      )
    );
  }
}
