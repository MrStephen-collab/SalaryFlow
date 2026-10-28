import { z } from "zod";

export const createSalaryPeriodSchema = z
  .object({
    name: z
      .string()
      .min(1, "Period name is required")
      .max(100, "Period name is too long"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    paymentDate: z.string().min(1, "Payment date is required"),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.startDate) <= new Date(data.endDate);
    },
    { message: "Start date must be before end date", path: ["endDate"] }
  );

export const salaryImportRowSchema = z.object({
  employeeNumber: z.string().min(1, "Employee number is required"),
  employeeName: z.string().optional(),
  basicSalary: z.coerce
    .number()
    .nonnegative("Salary must be a positive number")
    .finite("Salary must be a number"),
  allowances: z.coerce
    .number()
    .nonnegative("Allowances must be a positive number")
    .default(0),
  otherDeductions: z.coerce
    .number()
    .nonnegative("Deductions must be a positive number")
    .default(0),
});

export const salaryImportSchema = z.object({
  periodId: z.string().min(1, "Salary period is required"),
  rows: z.array(salaryImportRowSchema).min(1, "No rows to import"),
});

export type CreateSalaryPeriodValues = z.infer<typeof createSalaryPeriodSchema>;
export type SalaryImportValues = z.infer<typeof salaryImportSchema>;
export type SalaryImportRow = z.infer<typeof salaryImportRowSchema>;
