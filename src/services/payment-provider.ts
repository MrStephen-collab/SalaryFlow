/**
 * Payment provider abstraction (spec section 37).
 *
 * The application never depends on a single payout provider. Each adapter
 * implements the same contract; the active provider is chosen from
 * environment configuration.
 *
 * NOTE: real payouts are only enabled once a custody/settlement model and
 * provider credentials are configured (env: PAYMENT_PROVIDER, keys below).
 * Until then the ManualSettlementProvider is used, which requires a
 * finance officer to confirm an externally settled transfer with a
 * reference before a withdrawal is marked PAID.
 */

export interface TransferInput {
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reference: string;
}

export interface TransferResult {
  ok: boolean;
  providerReference?: string;
  error?: string;
}

export interface VerifyResult {
  verified: boolean;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createTransfer(input: TransferInput): Promise<TransferResult>;
  verifyTransfer(providerReference: string, externalReference: string): Promise<VerifyResult>;
}

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";

  async createTransfer(_input: TransferInput): Promise<TransferResult> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return {
        ok: false,
        error: "Paystack is not configured (PAYSTACK_SECRET_KEY missing). Falling back to manual settlement.",
      };
    }
    // Real integration goes here (https://api.paystack.co/transfer).
    return { ok: false, error: "Paystack transfer adapter not wired up yet." };
  }

  async verifyTransfer(_providerReference: string, _externalReference: string): Promise<VerifyResult> {
    return { verified: false, error: "Paystack transfer adapter not wired up yet." };
  }
}

export class FlutterwaveProvider implements PaymentProvider {
  readonly name = "flutterwave";

  async createTransfer(_input: TransferInput): Promise<TransferResult> {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return {
        ok: false,
        error: "Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY missing). Falling back to manual settlement.",
      };
    }
    return { ok: false, error: "Flutterwave transfer adapter not wired up yet." };
  }

  async verifyTransfer(_providerReference: string, _externalReference: string): Promise<VerifyResult> {
    return { verified: false, error: "Flutterwave transfer adapter not wired up yet." };
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
  const provider = process.env.PAYMENT_PROVIDER?.toLowerCase();
  if (provider === "paystack") return new PaystackProvider();
  if (provider === "flutterwave") return new FlutterwaveProvider();
  return new ManualSettlementProvider();
}