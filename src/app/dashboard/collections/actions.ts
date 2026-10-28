"use server";

import { CollectionsService } from "@/services/collections-service";

export async function refreshOverdue() {
  const service = await CollectionsService.create();
  return service.sweepOverdue();
}

export async function recoverShortfall(
  deductionRecordId: string,
  amount: number,
  note?: string
) {
  const service = await CollectionsService.create();
  return service.recoverShortfall(deductionRecordId, amount, note);
}

export async function waiveShortfall(deductionRecordId: string, reason: string) {
  const service = await CollectionsService.create();
  return service.waiveShortfall(deductionRecordId, reason);
}
