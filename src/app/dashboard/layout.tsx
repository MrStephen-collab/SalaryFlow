import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { requireUser, getProfile } from "@/lib/auth";
import { NotificationService } from "@/services/notification-service";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile();

  if (profile?.role === "EMPLOYEE") {
    redirect("/employee");
  }

  const notificationService = await NotificationService.create();
  const notifications = await notificationService.list(8);

  return (
    <SidebarProvider>
      <DashboardSidebar user={user} role={profile?.role ?? null} notifications={notifications} />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
