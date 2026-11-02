"use server";

import { LoanService } from "@/services/loan-service";
import { LoanSettlementService } from "@/services/loan-settlement-service";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { WithdrawalService } from "@/services/withdrawal-service";
import { ThriftService } from "@/services/thrift-service";
import type { BankAccountValues } from "@/schemas/withdrawal";

export async function requestThriftRelease(amount: number) {
  const service = await ThriftService.create();
  return service.requestRelease(amount);
}

export async function applyForLoan(
  loanProductId: string,
  amount: number,
  durationMonths: number,
  purpose?: string
): Promise<{ success?: string; error?: string }> {
  const portal = await EmployeePortalService.create();
  const employeeId = portal.getEmployeeId();
  if (!employeeId) {
    return { error: "No employee profile linked to this account" };
  }

  const service = await LoanService.create();
  const outcome = await service.applyForLoan(
    employeeId,
    loanProductId,
    amount,
    durationMonths,
    purpose
  );
  if ("error" in outcome) return { error: outcome.error };
  return { success: outcome.success };
}

export async function requestEarlySettlement(
  applicationId: string,
  note?: string
) {
  const service = await LoanSettlementService.create();
  return service.requestEarlySettlement(applicationId, note);
}

export async function addBankAccount(values: BankAccountValues) {
  const service = await WithdrawalService.create();
  return service.addBankAccount(values);
}

export async function removeBankAccount(bankAccountId: string) {
  const service = await WithdrawalService.create();
  return service.deleteBankAccount(bankAccountId);
}

export async function requestWithdrawal(
  amount: number,
  bankAccountId: string,
  pin: string
) {
  const service = await WithdrawalService.create();
  return service.requestWithdrawal({ amount, bankAccountId, pin });
}