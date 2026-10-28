"use server";

import { SettingsService } from "@/services/settings-service";
import type { OrganizationValues } from "@/schemas/settings";

export async function getOrganization() {
  const service = await SettingsService.create();
  return service.getOrganization();
}

export async function getOrganizationSettings() {
  const service = await SettingsService.create();
  return service.getSettings();
}

export async function updateOrganization(values: OrganizationValues) {
  const service = await SettingsService.create();
  return service.updateOrganization(values);
}

export async function updateOrganizationSettings(
  values: Record<string, unknown>
) {
  const service = await SettingsService.create();
  return service.updateSettings(values);
}