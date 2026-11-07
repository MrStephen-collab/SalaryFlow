/**
 * Payment provider abstraction.
 *
 * Collections (money coming in) are used to fund an organization's thrift
 * pool and to top up external members' savings. Transfers (money going out)
 * are used to settle employee/member withdrawals.
 *
 * The application never depends on a single provider. The active adapter is
 * chosen from environment configuration:
 *
 *   PAYMENT_PROVIDER=paystack|flutterwave
 *   PAYSTACK_SECRET_KEY=sk_live_...        PAYSTACK_PUBLIC_KEY=pk_live_...
 *   FLUTTERWAVE_SECRET_KEY=FLWSECK-...     FLUTTERWAVE_WEBHOOK_HASH=...
 *
 * With no provider configured the app falls back to ManualSettlementProvider,
 * which requires a finance officer to confirm an externally settled transfer
 * before a withdrawal is marked PAID. Collections are disabled in that mode.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface CollectionInput {
  /** Payer email (required by every gateway). */
  email: string;
  /** Major currency units, e.g. 150000.50 NGN. Converted to minor units internally. */
  amount: number;
  currency: string;
  /** Our own reference. Must be unique and is echoed back by the gateway. */
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface CollectionInit {
  ok: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  providerReference?: string;
  error?: string;
}

export interface CollectionStatus {
  /** Did the verification call itself succeed? */
  ok: boolean;
  /** Has the money actually been collected? */
  paid: boolean;
  amount?: number;
  currency?: string;
  providerReference?: string;
  channel?: string;
  fee?: number;
  paidAt?: string;
  error?: string;
}

export interface TransferInput {
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  narration?: string;
}

export interface TransferResult {
  ok: boolean;
  providerReference?: string;
  /** Gateway-side status, e.g. pending / success / failed. */
  status?: string;
  error?: string;
}

export interface VerifyResult {
  verified: boolean;
  status?: string;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** True when server-side credentials are present. */
  isConfigured(): boolean;
  /** Whether this adapter can take payments at all. */
  supportsCollections(): boolean;
  initializeCollection(input: CollectionInput): Promise<CollectionInit>;
  verifyCollection(reference: string): Promise<CollectionStatus>;
  /** Validate a webhook payload signature against the raw request body. */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  createTransfer(input: TransferInput): Promise<TransferResult>;
  verifyTransfer(providerReference: string, externalReference: string): Promise<VerifyResult>;
}

const PAYSTACK_BASE = "https://api.paystack.co";
const FLUTTERWAVE_BASE = "https://api.flutterwave.com/v3";

/**
 * Runtime overrides managed by the platform owner in the super-admin console.
 * They take precedence over environment variables.
 */
let runtimeConfig: {
  provider?: string;
  paystackSecretKey?: string;
  paystackPublicKey?: string;
  flutterwaveSecretKey?: string;
} = {};

export function setPaymentRuntimeConfig(config: typeof runtimeConfig) {
  runtimeConfig = { ...config };
}

function toMinorUnits(amount: number) {
  return Math.round(Number(amount) * 100);
}

function fromMinorUnits(amount: number) {
  return Math.round(Number(amount)) / 100;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

interface GatewayResponse {
  status?: boolean | string;
  message?: string;
  data?: Record<string, unknown>;
}

async function callGateway(
  url: string,
  init: RequestInit,
  label: string
): Promise<GatewayResponse> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as GatewayResponse;
    if (!response.ok || body.status === false || body.status === "error") {
      return {
        status: false,
        message: body.message ?? `${label} request failed (${response.status})`,
      };
    }
    return body;
  } catch (error) {
    return {
      status: false,
      message: error instanceof Error ? error.message : `${label} request failed`,
    };
  }
}

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";

  private get secretKey() {
    return (
      runtimeConfig.paystackSecretKey?.trim() ||
      process.env.PAYSTACK_SECRET_KEY?.trim() ||
      ""
    );
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  isConfigured() {
    return this.secretKey.length > 0;
  }

  supportsCollections() {
    return this.isConfigured();
  }

  async initializeCollection(input: CollectionInput): Promise<CollectionInit> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Paystack is not configured (PAYSTACK_SECRET_KEY missing)." };
    }

    const body = await callGateway(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          email: input.email,
          amount: toMinorUnits(input.amount),
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: input.metadata ?? {},
        }),
      },
      "Paystack initialize"
    );

    if (!body.data) {
      return { ok: false, error: body.message ?? "Paystack did not return a payment link." };
    }

    const data = body.data as {
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    };

    if (!data.authorization_url) {
      return { ok: false, error: body.message ?? "Paystack did not return a payment link." };
    }

    return {
      ok: true,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      providerReference: data.reference,
    };
  }

  async verifyCollection(reference: string): Promise<CollectionStatus> {
    if (!this.isConfigured()) {
      return { ok: false, paid: false, error: "Paystack is not configured." };
    }

    const body = await callGateway(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET", headers: this.headers() },
      "Paystack verify"
    );

    if (!body.data) {
      return { ok: false, paid: false, error: body.message ?? "Paystack verification failed." };
    }

    const data = body.data as {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      channel?: string;
      fees?: number;
      paid_at?: string;
    };

    return {
      ok: true,
      paid: data.status === "success",
      amount: typeof data.amount === "number" ? fromMinorUnits(data.amount) : undefined,
      currency: data.currency,
      providerReference: data.reference,
      channel: data.channel,
      fee: typeof data.fees === "number" ? fromMinorUnits(data.fees) : undefined,
      paidAt: data.paid_at,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Headers) {
    if (!this.isConfigured()) return false;
    const signature = headers.get("x-paystack-signature");
    if (!signature) return false;
    const expected = createHmac("sha512", this.secretKey).update(rawBody).digest("hex");
    return safeEqual(expected, signature);
  }

  async createTransfer(input: TransferInput): Promise<TransferResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error: "Paystack is not configured (PAYSTACK_SECRET_KEY missing). Falling back to manual settlement.",
      };
    }

    const recipientBody = await callGateway(
      `${PAYSTACK_BASE}/transferrecipient`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          type: "nuban",
          name: input.accountName,
          account_number: input.accountNumber,
          bank_code: input.bankCode,
          currency: input.currency,
        }),
      },
      "Paystack recipient"
    );

    const recipient = recipientBody.data as { recipient_code?: string } | undefined;
    if (!recipient?.recipient_code) {
      return { ok: false, error: recipientBody.message ?? "Could not create a Paystack recipient." };
    }

    const transferBody = await callGateway(
      `${PAYSTACK_BASE}/transfer`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          source: "balance",
          amount: toMinorUnits(input.amount),
          recipient: recipient.recipient_code,
          reason: input.narration ?? "SalaryFlow payout",
          reference: input.reference,
          currency: input.currency,
        }),
      },
      "Paystack transfer"
    );

    const transfer = transferBody.data as
      | { transfer_code?: string; status?: string; reference?: string }
      | undefined;

    if (!transfer?.transfer_code) {
      return { ok: false, error: transferBody.message ?? "Paystack transfer was rejected." };
    }

    return {
      ok: true,
      providerReference: transfer.transfer_code,
      status: transfer.status,
    };
  }

  async verifyTransfer(providerReference: string): Promise<VerifyResult> {
    if (!this.isConfigured()) {
      return { verified: false, error: "Paystack is not configured." };
    }

    const body = await callGateway(
      `${PAYSTACK_BASE}/transfer/verify/${encodeURIComponent(providerReference)}`,
      { method: "GET", headers: this.headers() },
      "Paystack transfer verify"
    );

    const data = body.data as { status?: string } | undefined;
    if (!data?.status) {
      return { verified: false, error: body.message ?? "Could not verify the transfer." };
    }

    return {
      verified: data.status === "success",
      status: data.status,
      error: data.status === "success" ? undefined : `Transfer is ${data.status}.`,
    };
  }
}

export class FlutterwaveProvider implements PaymentProvider {
  readonly name = "flutterwave";

  private get secretKey() {
    return (
      runtimeConfig.flutterwaveSecretKey?.trim() ||
      process.env.FLUTTERWAVE_SECRET_KEY?.trim() ||
      ""
    );
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  isConfigured() {
    return this.secretKey.length > 0;
  }

  supportsCollections() {
    return this.isConfigured();
  }

  async initializeCollection(input: CollectionInput): Promise<CollectionInit> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY missing)." };
    }

    const body = await callGateway(
      `${FLUTTERWAVE_BASE}/payments`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          tx_ref: input.reference,
          amount: input.amount,
          currency: input.currency,
          redirect_url: input.callbackUrl,
          customer: { email: input.email },
          meta: input.metadata ?? {},
          customizations: { title: "SalaryFlow" },
        }),
      },
      "Flutterwave initialize"
    );

    const data = body.data as { link?: string } | undefined;
    if (!data?.link) {
      return { ok: false, error: body.message ?? "Flutterwave did not return a payment link." };
    }

    return { ok: true, authorizationUrl: data.link, providerReference: input.reference };
  }

  async verifyCollection(reference: string): Promise<CollectionStatus> {
    if (!this.isConfigured()) {
      return { ok: false, paid: false, error: "Flutterwave is not configured." };
    }

    const response = await fetch(
      `${FLUTTERWAVE_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { method: "GET", headers: this.headers() }
    );

    const body = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        tx_ref?: string;
        channel?: string;
        app_fee?: number;
        created_at?: string;
      };
    };

    if (!body.data) {
      return { ok: false, paid: false, error: body.message ?? "Flutterwave verification failed." };
    }

    return {
      ok: true,
      paid: body.data.status === "successful",
      amount: typeof body.data.amount === "number" ? body.data.amount : undefined,
      currency: body.data.currency,
      providerReference: body.data.tx_ref,
      channel: body.data.channel,
      fee: typeof body.data.app_fee === "number" ? body.data.app_fee : undefined,
      paidAt: body.data.created_at,
    };
  }

  verifyWebhookSignature(_rawBody: string, headers: Headers) {
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH?.trim();
    if (!expected) return false;
    const provided = headers.get("verif-hash");
    if (!provided) return false;
    return safeEqual(expected, provided);
  }

  async createTransfer(input: TransferInput): Promise<TransferResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error: "Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY missing). Falling back to manual settlement.",
      };
    }

    const body = await callGateway(
      `${FLUTTERWAVE_BASE}/transfers`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          account_bank: input.bankCode,
          account_number: input.accountNumber,
          amount: input.amount,
          narration: input.narration ?? "SalaryFlow payout",
          currency: input.currency,
          reference: input.reference,
          beneficiary_name: input.accountName,
        }),
      },
      "Flutterwave transfer"
    );

    const data = body.data as { id?: number | string; status?: string } | undefined;
    if (!data?.id) {
      return { ok: false, error: body.message ?? "Flutterwave transfer was rejected." };
    }

    return { ok: true, providerReference: String(data.id), status: data.status };
  }

  async verifyTransfer(providerReference: string): Promise<VerifyResult> {
    if (!this.isConfigured()) {
      return { verified: false, error: "Flutterwave is not configured." };
    }

    const body = await callGateway(
      `${FLUTTERWAVE_BASE}/transfers/${encodeURIComponent(providerReference)}`,
      { method: "GET", headers: this.headers() },
      "Flutterwave transfer verify"
    );

    const data = body.data as { status?: string } | undefined;
    if (!data?.status) {
      return { verified: false, error: body.message ?? "Could not verify the transfer." };
    }

    return {
      verified: data.status === "successful",
      status: data.status,
      error: data.status === "successful" ? undefined : `Transfer is ${data.status}.`,
    };
  }
}

/**
 * Default provider used when no payout integration is configured.
 * A withdrawal only becomes PAID after the finance officer provides the
 * external bank settlement reference, satisfying the rule that a withdrawal
 * is not marked paid merely because an internal record was created.
 */
export class ManualSettlementProvider implements PaymentProvider {
  readonly name = "manual";

  isConfigured() {
    return true;
  }

  supportsCollections() {
    return false;
  }

  async initializeCollection(): Promise<CollectionInit> {
    return {
      ok: false,
      error:
        "No payment gateway is configured yet. Add PAYSTACK_SECRET_KEY (and PAYMENT_PROVIDER=paystack) to enable online funding.",
    };
  }

  async verifyCollection(): Promise<CollectionStatus> {
    return { ok: false, paid: false, error: "No payment gateway is configured." };
  }

  verifyWebhookSignature() {
    return false;
  }

  async createTransfer(_input: TransferInput): Promise<TransferResult> {
    return {
      ok: true,
      error: "No automated payout provider configured - awaiting manual settlement.",
    };
  }

  async verifyTransfer(providerReference: string, externalReference: string): Promise<VerifyResult> {
    if (externalReference.trim().length > 0) {
      return { verified: true };
    }
    return { verified: false, error: "External settlement reference is required to confirm payment." };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const provider = (
    runtimeConfig.provider ||
    process.env.PAYMENT_PROVIDER ||
    ""
  ).toLowerCase();
  if (provider === "paystack") return new PaystackProvider();
  if (provider === "flutterwave") return new FlutterwaveProvider();
  if (provider === "manual") return new ManualSettlementProvider();

  if (runtimeConfig.paystackSecretKey?.trim()) return new PaystackProvider();
  if (process.env.PAYSTACK_SECRET_KEY?.trim()) return new PaystackProvider();
  if (runtimeConfig.flutterwaveSecretKey?.trim()) return new FlutterwaveProvider();
  if (process.env.FLUTTERWAVE_SECRET_KEY?.trim()) return new FlutterwaveProvider();
  return new ManualSettlementProvider();
}

export function getPaymentProviderByName(name: string): PaymentProvider | null {
  if (name === "paystack") return new PaystackProvider();
  if (name === "flutterwave") return new FlutterwaveProvider();
  if (name === "manual") return new ManualSettlementProvider();
  return null;
}

export function gatewayStatus() {
  const provider = getPaymentProvider();
  return {
    provider: provider.name,
    configured: provider.isConfigured(),
    collections: provider.supportsCollections(),
  };
}
