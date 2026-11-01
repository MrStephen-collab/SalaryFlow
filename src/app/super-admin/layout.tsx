import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { SuperAdminSidebar } from "@/components/super-admin/super-admin-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationService } from "@/services/notification-service";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireSuperAdmin();

  const notificationService = await NotificationService.create();
  const notifications = await notificationService.list(8);

  return (
    <SidebarProvider>
      <SuperAdminSidebar user={user} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-6 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <span className="hidden rounded-md border px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
            Platform owner
          </span>
          <div className="flex items-center gap-1">
            <NotificationBell
              items={notifications}
              viewAllHref="/super-admin/notifications"
            />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pb-20 lg:gap-6 lg:p-6 lg:pb-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
