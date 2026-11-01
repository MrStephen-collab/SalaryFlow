import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/lib/auth";
import { MemberSidebar } from "@/components/member/member-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationService } from "@/services/notification-service";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile();

  if (!profile) {
    redirect("/onboarding");
  }
  if (profile.role !== "MEMBER") {
    if (profile.role === "EMPLOYEE") redirect("/employee");
    if (profile.role === "SUPER_ADMIN") redirect("/super-admin");
    redirect("/dashboard");
  }

  const initials = (user.user_metadata?.full_name ?? user.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  const notificationService = await NotificationService.create();
  const notifications = await notificationService.list(12);

  return (
    <SidebarProvider>
      <MemberSidebar user={user} notifications={notifications} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-6 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">
                {user.user_metadata?.full_name ?? "Member"}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.user_metadata?.avatar_url ?? ""}
                alt={user.email ?? ""}
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              items={notifications}
              viewAllHref="/member/notifications"
            />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pb-20 lg:gap-6 lg:p-6 lg:pb-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
        <MobileBottomNav variant="member" />
      </SidebarInset>
    </SidebarProvider>
  );
}
