import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
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
        <header className="flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur print:hidden">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <div className="flex-1" />
          <UserMenu
            name={user.user_metadata?.full_name ?? user.email ?? "User"}
            email={user.email ?? ""}
            avatarUrl={user.user_metadata?.avatar_url ?? null}
          />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pb-20 lg:gap-6 lg:p-6 lg:pb-6">
          {children}
        </div>
        <MobileBottomNav variant="dashboard" />
      </SidebarInset>
    </SidebarProvider>
  );
}
