"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementService } from "@/services/announcement-service";

export async function createAnnouncement(message: string) {
  const service = await AnnouncementService.create();
  const result = await service.create(message);
  if (result.ok) revalidatePath("/dashboard/announcements");
  return result;
}

export async function updateAnnouncement(
  id: string,
  values: { message?: string; active?: boolean }
) {
  const service = await AnnouncementService.create();
  const result = await service.update(id, values);
  if (result.ok) revalidatePath("/dashboard/announcements");
  return result;
}

export async function deleteAnnouncement(id: string) {
  const service = await AnnouncementService.create();
  const result = await service.remove(id);
  if (result.ok) revalidatePath("/dashboard/announcements");
  return result;
}
