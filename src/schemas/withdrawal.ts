import { z } from "zod";

export const bankAccountSchema = z.object({
  bankName: z.string().min(2, "Bank name is required"),
  bankCode: z.string().optional(),
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, "Account number must be 10 digits"),
  accountName: z.string().min(2, "Account name is required"),
});

export const withdrawalSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0"),
  bankAccountId: z.string().min(1, "Select a bank account"),
});

export type BankAccountValues = z.infer<typeof bankAccountSchema>;
export type WithdrawalValues = z.infer<typeof withdrawalSchema>;