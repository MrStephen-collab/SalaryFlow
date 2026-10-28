"use server";

import { DeductionService } from "@/services/deduction-service";

export async function generateScheduledDeductions(periodId: string) {
  const service = await DeductionService.create();
  return service.generateScheduledDeductions(periodId);
}

export async function processDeduction(deductionRecordId: string, actualAmount: number) {
  const service = await DeductionService.create();
  return service.processDeduction(deductionRecordId, actualAmount);
}

export async function previewPayroll(periodId: string) {
  const service = await DeductionService.create();
  return service.previewPayroll(periodId);
}

export async function exportPayrollCSV(periodId: string) {
  const service = await DeductionService.create();
  return service.exportPayrollCSV(periodId);
}

export async function listDeductions(periodId?: string) {
  const service = await DeductionService.create();
  return service.listDeductions(periodId);
}