"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementService } from "@/services/announcement-service";

export async function createAnnouncement(
  message: string,
  audience: "ALL" | "EMPLOYEE" | "MEMBER" = "ALL"
) {
  const service = await AnnouncementService.create();
  const result = await service.create(message, audience);
  if (result.ok) revalidatePath("/dashboard/announcements");
  return result;
}

export async function updateAnnouncement(
  id: string,
  values: { message?: string; active?: boolean; audience?: "ALL" | "EMPLOYEE" | "MEMBER" }
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
