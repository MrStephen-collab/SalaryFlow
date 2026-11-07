export const MODE_KEYS = new Set(["payment_mode", "email_mode", "sms_mode"]);

export const SINGLE_KEYS = new Set([
  "payment_mode",
  "payment_provider",
  "email_mode",
  "email_provider",
  "email_from",
  "sms_mode",
  "sms_provider",
  "sms_sender",
]);

export const PAIR_BASES = [
  "paystack_public_key",
  "paystack_secret_key",
  "flutterwave_secret_key",
  "email_api_key",
  "sms_api_key",
];

export const PROVIDER_OPTIONS: Record<string, string[]> = {
  payment_provider: ["paystack", "flutterwave", "manual"],
  email_provider: ["resend", "smtp"],
  sms_provider: ["termii", "twilio"],
};
