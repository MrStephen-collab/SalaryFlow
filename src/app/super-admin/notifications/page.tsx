import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { NotificationService } from "@/services/notification-service";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function SuperAdminNotificationsPage() {
  await requireSuperAdmin();
  const service = await NotificationService.create();
  const items = await service.list(50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Platform activity across organizations.
        </p>
      </div>
      <NotificationList items={items} />
    </div>
  );
}
