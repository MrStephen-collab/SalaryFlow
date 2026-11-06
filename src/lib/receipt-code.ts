import { createHmac, timingSafeEqual } from "node:crypto";

export const RECEIPT_TYPES = ["repayment", "thrift", "withdrawal"] as const;

export type ReceiptType = (typeof RECEIPT_TYPES)[number];

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  repayment: "Loan Repayment Receipt",
  thrift: "Thrift Funding Receipt",
  withdrawal: "Withdrawal Receipt",
};

const RECEIPT_PREFIXES: Record<ReceiptType, string> = {
  repayment: "R",
  thrift: "T",
  withdrawal: "W",
};

export function isReceiptType(value: string): value is ReceiptType {
  return (RECEIPT_TYPES as readonly string[]).includes(value);
}

/**
 * Receipt codes are stateless: the code encodes the receipt type and record id
 * and is signed with an HMAC. No extra table is required to verify a receipt.
 *
 * The signing key falls back to the Supabase service role key so codes stay
 * stable across environments without extra configuration. Set
 * RECEIPT_VERIFICATION_SECRET to rotate it independently.
 */
function signingKey(): string {
  const key =
    process.env.RECEIPT_VERIFICATION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Receipt verification secret is not configured");
  }

  return key;
}

function payloadFor(type: ReceiptType, id: string) {
  return `v1:${type}:${id}`;
}

function sign(payload: string) {
  return createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
}

export function createReceiptCode(type: ReceiptType, id: string): string {
  const payload = payloadFor(type, id);
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(payload)}`;
}

export function readReceiptCode(
  code: string
): { type: ReceiptType; id: string } | null {
  if (!code) return null;

  const separator = code.lastIndexOf(".");
  if (separator <= 0 || separator === code.length - 1) return null;

  const encoded = code.slice(0, separator);
  const signature = code.slice(separator + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const [, type, id] = parts;
  if (!isReceiptType(type) || !id) return null;

  const expected = sign(payload);
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (received.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(received, expectedBuffer)) return null;

  return { type, id };
}

export function receiptNumber(
  type: ReceiptType,
  id: string,
  issuedAt: string
): string {
  const date = new Date(issuedAt);
  const valid = !Number.isNaN(date.getTime());
  const period = valid
    ? `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`
    : new Date().toISOString().slice(0, 7).replace("-", "");

  return `SLF-RCPT-${RECEIPT_PREFIXES[type]}-${period}-${id
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase()}`;
}
