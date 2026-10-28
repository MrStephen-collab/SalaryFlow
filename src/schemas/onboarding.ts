import { z } from "zod";
import { organizationSchema, organizationSettingsSchema } from "./settings";

export const onboardingSchema = z.object({
  organization: organizationSchema,
  settings: organizationSettingsSchema,
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;