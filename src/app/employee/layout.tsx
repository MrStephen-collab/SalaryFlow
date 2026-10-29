import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/lib/auth";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { EmployeeSidebar } from "@/components/employee/employee-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationService } from "@/services/notification-service";

export default async function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  const [profile, service, notifications] = await Promise.all([
    getProfile(),
    EmployeePortalService.create(),
    NotificationService.create().then((notifications) => notifications.list(8)),
  ]);
  if (profile && profile.role !== "EMPLOYEE") {
    redirect("/dashboard");
  }

  const employee = await service.getEmployee();

  const initials = (employee
    ? `${employee.first_name?.[0] ?? ""}${employee.last_name?.[0] ?? ""}`
    : user.email ?? "U"
  )
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarProvider>
      <EmployeeSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-6 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">
                {employee
                  ? `${employee.first_name} ${employee.last_name}`
                  : user.user_metadata?.full_name ?? "Employee"}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url ?? ""} alt={user.email ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell items={notifications} viewAllHref="/employee/notifications" />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
