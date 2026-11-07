import { createAdminClient } from "@/lib/supabase/admin";
import { setPaymentRuntimeConfig } from "@/services/payment-provider";

type Cache = { at: number; values: Record<string, string> };

let platformCache: Cache | null = null;
const organizationCache = new Map<string, Cache>();
const TTL = 5 * 60 * 1000;

/**
 * Load platform integration values saved by the super admin. Cached briefly to
 * avoid a database round-trip on every request. Environment variables remain a
 * fallback when a value is empty.
 */
export async function loadPlatformConfig(force = false) {
  if (!force && platformCache && Date.now() - platformCache.at < TTL) {
    return platformCache.values;
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_integrations")
      .select("key, value");
    const values = Object.fromEntries(
      (data ?? []).map((row) => [row.key as string, (row.value as string) ?? ""])
    );
    platformCache = { at: Date.now(), values };
    return values;
  } catch {
    return platformCache?.values ?? {};
  }
}

/**
 * Load the effective integration configuration for one organization. Non-empty
 * organization overrides take precedence over platform defaults.
 */
export async function loadOrganizationConfig(
  organizationId?: string | null,
  force = false
) {
  const platform = await loadPlatformConfig(force);
  if (!organizationId) return platform;

  if (!force) {
    const cached = organizationCache.get(organizationId);
    if (cached && Date.now() - cached.at < TTL) return cached.values;
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("organization_integrations")
      .select("key, value")
      .eq("organization_id", organizationId);

    const overrides = Object.fromEntries(
      (data ?? [])
        .filter((row) => String(row.value ?? "").trim().length > 0)
        .map((row) => [row.key as string, row.value as string])
    );

    const values = { ...platform, ...overrides };
    organizationCache.set(organizationId, { at: Date.now(), values });
    return values;
  } catch {
    return platform;
  }
}

/** Apply the saved payment credentials before a provider call. */
export async function preparePaymentProvider(organizationId?: string | null) {
  const values = await loadOrganizationConfig(organizationId);
  setPaymentRuntimeConfig({
    provider: values.payment_provider?.trim() || undefined,
    paystackSecretKey: values.paystack_secret_key?.trim() || undefined,
    paystackPublicKey: values.paystack_public_key?.trim() || undefined,
    flutterwaveSecretKey: values.flutterwave_secret_key?.trim() || undefined,
  });
  return values;
}

export function clearPlatformConfigCache() {
  platformCache = null;
  organizationCache.clear();
}

export function clearOrganizationConfigCache(organizationId: string) {
  organizationCache.delete(organizationId);
}
