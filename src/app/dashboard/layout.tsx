import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
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
        <header className="flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-4"
          />
          <SalaryFlowLogo variant="icon" size="sm" />
          <span className="text-sm font-semibold">Navigation</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
