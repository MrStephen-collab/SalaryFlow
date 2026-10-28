import { z } from "zod";
import { organizationSchema } from "./settings";

export const subscriptionPlanSchema = z.object({
  name: z.string().min(2, "Plan name is required").max(100),
  description: z.string().max(500).optional(),
  max_employees: z.coerce.number().int().positive("Must be at least 1"),
  max_branches: z.coerce.number().int().positive("Must be at least 1"),
  max_active_loans: z.coerce
    .number()
    .int()
    .positive("Must be at least 1"),
  price_monthly: z.coerce.number().nonnegative("Cannot be negative"),
  price_annually: z.coerce.number().nonnegative("Cannot be negative"),
});

export type SubscriptionPlanValues = z.infer<typeof subscriptionPlanSchema>;

export const enrollOrganizationSchema = z.object({
  organization: organizationSchema,
  plan_id: z.string().uuid("Select a valid plan").optional(),
  trial_days: z.coerce
    .number()
    .int()
    .min(0, "Trial cannot be negative")
    .max(90, "Trial cannot exceed 90 days")
    .default(0),
});

export type EnrollOrganizationValues = z.infer<
  typeof enrollOrganizationSchema
>;