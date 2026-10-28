"use server";

import { LoanService } from "@/services/loan-service";
import { LoanSettlementService } from "@/services/loan-settlement-service";
import type { RestructureInput } from "@/services/loan-settlement-service";
import type { CreateLoanProductValues } from "@/schemas/loan";

export async function listLoanProducts() {
  const service = await LoanService.create();
  return service.listProducts();
}

export async function getLoanProduct(productId: string) {
  const service = await LoanService.create();
  return service.getProduct(productId);
}

export async function createLoanProduct(values: CreateLoanProductValues) {
  const service = await LoanService.create();
  return service.createProduct(values);
}

export async function updateLoanProduct(
  productId: string,
  values: Partial<CreateLoanProductValues>
) {
  const service = await LoanService.create();
  return service.updateProduct(productId, values);
}

export async function toggleLoanProductActive(
  productId: string,
  active: boolean
) {
  const service = await LoanService.create();
  return service.toggleProductActive(productId, active);
}

export async function deleteLoanProduct(productId: string) {
  const service = await LoanService.create();
  return service.deleteProduct(productId);
}

export async function listLoanApplications(status?: string) {
  const service = await LoanService.create();
  return service.listApplications(status);
}

export async function getLoanApplication(applicationId: string) {
  const service = await LoanService.create();
  return service.getApplication(applicationId);
}

export async function applyForLoan(
  employeeId: string,
  loanProductId: string,
  amount: number,
  durationMonths: number,
  purpose?: string
): Promise<{ success?: string; error?: string }> {
  const service = await LoanService.create();
  const outcome = await service.applyForLoan(employeeId, loanProductId, amount, durationMonths, purpose);
  if ("error" in outcome) return { error: outcome.error };
  return { success: outcome.success };
}

export async function approveLoanApplication(applicationId: string, notes?: string) {
  const service = await LoanService.create();
  return service.approveApplication(applicationId, notes);
}

export async function rejectLoanApplication(applicationId: string, reason: string) {
  const service = await LoanService.create();
  return service.rejectApplication(applicationId, reason);
}

export async function disburseLoan(applicationId: string) {
  const service = await LoanService.create();
  return service.disburseLoan(applicationId);
}

export async function getLoanSchedule(applicationId: string) {
  const service = await LoanService.create();
  return service.getSchedule(applicationId);
}

export async function recordLoanRepayment(
  applicationId: string,
  scheduleId: string,
  amount: number,
  paymentMethod?: string
) {
  const service = await LoanService.create();
  return service.recordRepayment(applicationId, scheduleId, amount, paymentMethod);
}

export async function getSettlementQuote(applicationId: string) {
  const service = await LoanSettlementService.create();
  return service.getSettlementQuote(applicationId);
}

export async function settleLoanEarly(applicationId: string, note?: string) {
  const service = await LoanSettlementService.create();
  return service.settleEarly(applicationId, { note });
}

export async function restructureLoan(
  applicationId: string,
  input: RestructureInput
) {
  const service = await LoanSettlementService.create();
  return service.restructureLoan(applicationId, input);
}
