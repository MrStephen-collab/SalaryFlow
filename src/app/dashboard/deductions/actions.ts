"use server";

import { DeductionService } from "@/services/deduction-service";
import {
  PayrollReconciliationService,
  parseActualDeductionsCsv,
  type ActualDeductionInput,
} from "@/services/payroll-reconciliation-service";

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

export async function getPayrollReconciliation(periodId: string) {
  const service = await PayrollReconciliationService.create();
  return service.getReconciliation(periodId);
}

export async function importPayrollActuals(
  periodId: string,
  rows: ActualDeductionInput[]
) {
  const service = await PayrollReconciliationService.create();
  return service.importActuals(periodId, rows);
}

export async function importPayrollActualsCsv(periodId: string, csv: string) {
  const parsed = parseActualDeductionsCsv(csv);
  if ("error" in parsed) return { error: parsed.error };

  const service = await PayrollReconciliationService.create();
  return service.importActuals(periodId, parsed.rows);
}

export async function applyPayrollReconciliation(periodId: string) {
  const service = await PayrollReconciliationService.create();
  return service.applyReconciliation(periodId);
}

export async function exportReconciliationCSV(periodId: string) {
  const service = await PayrollReconciliationService.create();
  return service.exportReconciliationCSV(periodId);
}

export async function exportReconciliationTemplate(periodId: string) {
  const service = await PayrollReconciliationService.create();
  return service.exportReconciliationTemplate(periodId);
}
