import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProviderByName } from "@/services/payment-provider";
import { PaymentService } from "@/services/payment-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PaystackEvent {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    transfer_code?: string;
    recipient?: { details?: { account_number?: string } };
  };
}

interface FlutterwaveEvent {
  event?: string;
  "event.type"?: string;
  data?: {
    tx_ref?: string;
    status?: string;
    id?: number | string;
    reference?: string;
  };
}

/**
 * Gateway webhooks. Signatures are verified against the raw body before any
 * state changes. Both gateways retry, so every handler must be idempotent -
 * PaymentService.settle claims each intent before crediting it.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: providerName } = await context.params;
  const provider = getPaymentProviderByName(providerName);

  if (!provider || !provider.supportsCollections()) {
    return NextResponse.json({ error: "Unknown payment provider" }, { status: 404 });
  }

  const rawBody = await request.text();

  if (!provider.verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PaystackEvent & FlutterwaveEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackEvent & FlutterwaveEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    if (providerName === "paystack") {
      const event = payload.event;
      const reference = payload.data?.reference;

      if (event === "charge.success" && reference) {
        const result = await PaymentService.settle(reference);
        if (!result.ok) {
          // Returning 500 lets Paystack retry a settlement that could not be
          // applied (for example a temporary database error).
          return NextResponse.json({ received: true, retry: true }, { status: 500 });
        }
      }

      if (event === "transfer.success" || event === "transfer.failed") {
        await syncTransferOutcome(
          providerName,
          payload.data?.transfer_code,
          event === "transfer.success",
          event === "transfer.failed" ? "Paystack reported the transfer failed" : undefined
        );
      }
    }

    if (providerName === "flutterwave") {
      const status = payload.data?.status;
      const reference = payload.data?.tx_ref;

      if (
        (payload.event === "charge.completed" || payload["event.type"] === "CHARGE_COMPLETED") &&
        reference &&
        status === "successful"
      ) {
        const result = await PaymentService.settle(reference);
        if (!result.ok) {
          return NextResponse.json({ received: true, retry: true }, { status: 500 });
        }
      }

      if (payload.event === "transfer.completed" && payload.data?.reference) {
        const succeeded = status === "successful";
        await syncTransferOutcome(
          providerName,
          payload.data.reference,
          succeeded,
          succeeded ? undefined : "Flutterwave reported the transfer failed"
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    console.error("[payments/webhook]", providerName, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Payout webhooks let a withdrawal become PAID without a finance officer
 * pasting a settlement reference, but only after the gateway confirms it.
 */
async function syncTransferOutcome(
  provider: string,
  providerReference: string | undefined,
  succeeded: boolean,
  failureReason?: string
) {
  if (!providerReference) return;

  const admin = createAdminClient();
  const { data: withdrawal } = await admin
    .from("withdrawal_requests")
    .select("id, status, employee_id, amount, bank_account_id")
    .eq("provider_reference", providerReference)
    .maybeSingle();

  if (!withdrawal) return;
  if (withdrawal.status === "PAID") return;

  if (succeeded) {
    const { error } = await admin
      .from("withdrawal_requests")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", withdrawal.id)
      .neq("status", "PAID");

    if (error) return;

    const { LedgerService } = await import("@/services/ledger-service");
    const { data: employee } = await admin
      .from("employees")
      .select("organization_id")
      .eq("id", withdrawal.employee_id)
      .maybeSingle();

    if (employee?.organization_id) {
      const ledger = LedgerService.createForOrganization(employee.organization_id);
      await ledger.postWithdrawal(
        withdrawal.employee_id,
        withdrawal.id,
        Number(withdrawal.amount)
      );
    }

    await admin.from("withdrawal_requests").update({ provider_reference: providerReference }).eq("id", withdrawal.id);
    void provider;
    return;
  }

  await admin
    .from("withdrawal_requests")
    .update({
      status: "FAILED",
      failure_reason: failureReason ?? "Gateway reported the payout failed",
    })
    .eq("id", withdrawal.id)
    .in("status", ["PROCESSING", "APPROVED"]);
}
