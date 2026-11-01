import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NotificationService } from "@/services/notification-service";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function DashboardNotificationsPage() {
  await requireUser();
  const service = await NotificationService.create();
  const items = await service.list(50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Loan requests, withdrawal requests, shortfalls and repayment updates.
        </p>
      </div>
      <NotificationList items={items} />
    </div>
  );
}
