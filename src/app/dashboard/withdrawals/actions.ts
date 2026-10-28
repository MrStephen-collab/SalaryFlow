"use server";

import { WithdrawalService } from "@/services/withdrawal-service";

export async function submitWithdrawalForReview(
  withdrawalId: string,
  notes?: string
) {
  const service = await WithdrawalService.create();
  return service.submitForReview(withdrawalId, notes);
}

export async function approveWithdrawal(withdrawalId: string, notes?: string) {
  const service = await WithdrawalService.create();
  return service.approve(withdrawalId, notes);
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  const service = await WithdrawalService.create();
  return service.reject(withdrawalId, reason);
}

export async function processWithdrawal(withdrawalId: string) {
  const service = await WithdrawalService.create();
  return service.process(withdrawalId);
}

export async function confirmWithdrawalPaid(
  withdrawalId: string,
  externalReference: string
) {
  const service = await WithdrawalService.create();
  return service.markPaid(withdrawalId, externalReference);
}

export async function failWithdrawal(withdrawalId: string, reason: string) {
  const service = await WithdrawalService.create();
  return service.fail(withdrawalId, reason);
}