import { createAdminClient } from "@/lib/supabase/admin";
import { setPaymentRuntimeConfig } from "@/services/payment-provider";

type Cache = { at: number; values: Record<string, string> };

let cache: Cache | null = null;
const TTL = 5 * 60 * 1000;

/**
 * Load platform integration values saved by the super admin. Cached briefly to
 * avoid a database round-trip on every request. Environment variables remain a
 * fallback when a value is empty.
 */
export async function loadPlatformConfig(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL) {
    return cache.values;
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_integrations")
      .select("key, value");
    const values = Object.fromEntries(
      (data ?? []).map((row) => [row.key as string, (row.value as string) ?? ""])
    );
    cache = { at: Date.now(), values };
    return values;
  } catch {
    return cache?.values ?? {};
  }
}

/** Apply the saved payment credentials before a provider call. */
export async function preparePaymentProvider() {
  const values = await loadPlatformConfig();
  setPaymentRuntimeConfig({
    provider: values.payment_provider?.trim() || undefined,
    paystackSecretKey: values.paystack_secret_key?.trim() || undefined,
    paystackPublicKey: values.paystack_public_key?.trim() || undefined,
    flutterwaveSecretKey: values.flutterwave_secret_key?.trim() || undefined,
  });
  return values;
}

export function clearPlatformConfigCache() {
  cache = null;
}
