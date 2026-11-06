"use server";

import { CollectionsService } from "@/services/collections-service";

export async function refreshOverdue() {
  const service = await CollectionsService.create();
  return service.sweepOverdue();
}
