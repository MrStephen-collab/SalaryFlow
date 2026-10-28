import { z } from "zod";

export const INTEREST_METHODS = ["FLAT", "REDUCING_BALANCE", "AMORTIZED"] as const;
export const REPETITION_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

export const createLoanProductSchema = z
  .object({
    name: z
      .string()
      .min(1, "Product name is required")
      .max(100, "Product name is too long"),
    description: z.string().max(500).optional(),
    minimumAmount: z.coerce
      .number()
      .nonnegative("Minimum amount must be positive")
      .finite(),
    maximumAmount: z.coerce
      .number()
      .positive("Maximum amount must be greater than 0")
      .finite(),
    interestRate: z.coerce
      .number()
      .nonnegative("Interest rate must be positive")
      .max(100, "Interest rate cannot exceed 100%"),
    interestMethod: z.enum(INTEREST_METHODS),
    durationMonths: z.coerce
      .number()
      .int("Duration must be a whole number")
      .positive("Duration must be at least 1 month")
      .max(120, "Duration cannot exceed 120 months"),
    repaymentFrequency: z.enum(REPETITION_FREQUENCIES),
    processingFee: z.coerce
      .number()
      .nonnegative("Processing fee must be positive")
      .default(0),
    insuranceFee: z.coerce
      .number()
      .nonnegative("Insurance fee must be positive")
      .default(0),
    maximumSalaryDeductionPercentage: z.coerce
      .number()
      .positive("Deduction percentage must be positive")
      .max(100, "Cannot exceed 100%"),
    minimumSalary: z.coerce
      .number()
      .nonnegative("Minimum salary must be positive")
      .default(0),
    minimumEmploymentPeriodMonths: z.coerce
      .number()
      .nonnegative("Minimum employment period must be positive")
      .int()
      .default(0),
    guarantorRequired: z.boolean().default(false),
    collateralRequired: z.boolean().default(false),
  })
  .refine((data) => data.minimumAmount < data.maximumAmount, {
    message: "Minimum amount must be less than maximum amount",
    path: ["maximumAmount"],
  });

export type CreateLoanProductValues = z.infer<typeof createLoanProductSchema>;

export const loanApplicationSchema = z.object({
  loanProductId: z.string().min(1, "Loan product is required"),
  amount: z.coerce
    .number()
    .positive("Loan amount must be greater than 0")
    .finite(),
  durationMonths: z.coerce
    .number()
    .int("Duration must be a whole number")
    .positive("Duration must be at least 1 month"),
  purpose: z.string().max(500).optional(),
});

export type LoanApplicationValues = z.infer<typeof loanApplicationSchema>;
