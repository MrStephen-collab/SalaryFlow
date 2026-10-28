import { z } from "zod";
import { INTEREST_METHODS } from "./loan";

export const SALARY_CYCLES = ["weekly", "biweekly", "monthly"] as const;
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
  currency: z.string().min(1, "Currency is required"),
});

export type OrganizationValues = z.infer<typeof organizationSchema>;

export const organizationSettingsSchema = z.object({
  salary_cycle: z.enum(SALARY_CYCLES),
  max_salary_deduction_percentage: z.coerce
    .number()
    .nonnegative()
    .max(100, "Cannot exceed 100%"),
  min_salary: z.coerce.number().nonnegative("Minimum salary cannot be negative"),
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
});

export type OrganizationSettingsValues = z.infer<
  typeof organizationSettingsSchema
>;