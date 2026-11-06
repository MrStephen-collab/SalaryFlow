"use server";

import { revalidatePath } from "next/cache";
import { PlatformIntegrationService } from "@/services/platform-integration-service";
import { clearPlatformConfigCache } from "@/lib/platform-config";

export async function saveIntegrations(values: Record<string, string>) {
  const service = await PlatformIntegrationService.create();
  const result = await service.save(values);
  if (result.ok) {
    clearPlatformConfigCache();
    revalidatePath("/super-admin/integrations");
  }
  return result;
}

export async function setMaintenanceMode(enabled: boolean) {
  const service = await PlatformIntegrationService.create();
  const result = await service.setMaintenanceMode(enabled);
  if (result.ok) {
    revalidatePath("/super-admin/integrations");
    revalidatePath("/super-admin");
  }
  return result;
}
