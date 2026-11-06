import { z } from "zod";
import { INTEREST_METHODS } from "./loan";

export const APPROVAL_WORKFLOWS = ["one_level", "two_level"] as const;
export const CURRENCIES = ["NGN", "USD", "GBP", "GHS", "KES", "ZAR"] as const;

export const organizationSchema = z.object({
  name: z.string().min(2, "Organization name is required").max(200),
  type: z.string().min(1, "Organization type is required"),
  registrationNumber: z.string().max(100).optional(),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(6, "Phone number is required").max(30),
  address: z.string().max(500).optional(),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  nin: z
    .string()
    .regex(/^\d{11}$/, "NIN must be 11 digits")
    .optional()
    .or(z.literal("")),
  ninDocumentUrl: z.string().optional().or(z.literal("")),
  currency: z.string().min(1, "Currency is required"),
});

export type OrganizationValues = z.infer<typeof organizationSchema>;

export const organizationSettingsSchema = z.object({
  min_employment_period_months: z.coerce
    .number()
    .int()
    .nonnegative("Must be a whole number"),
  max_loan_amount: z.coerce
    .number()
    .positive()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  default_interest_rate: z.coerce
    .number()
    .nonnegative()
    .max(100, "Rate cannot exceed 100%")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  default_interest_method: z.enum(INTEREST_METHODS),
  max_tenure: z.coerce
    .number()
    .int()
    .positive("Max tenure must be at least 1 month")
    .max(120),
  guarantor_required: z.boolean().default(false),
  approval_workflow: z.enum(APPROVAL_WORKFLOWS),
  withdrawals_enabled: z.boolean().default(false),
  thrift_interest_rate: z.coerce
    .number()
    .min(0)
    .max(100, "Rate cannot exceed 100%")
    .default(5),
  savings_min_membership_months: z.coerce.number().int().min(0).max(60).default(6),
  member_loan_multiplier: z.coerce.number().min(1).max(10).default(2),
  member_savings_withdrawals_enabled: z.boolean().default(true),
});

export type OrganizationSettingsValues = z.infer<
  typeof organizationSettingsSchema
>;