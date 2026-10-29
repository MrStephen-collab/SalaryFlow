import type { ReactNode } from "react";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { SuperAdminNav } from "@/components/super-admin/super-admin-nav";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { NotificationService } from "@/services/notification-service";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSuperAdmin();

  const notificationService = await NotificationService.create();
  const notifications = await notificationService.list(8);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background print:hidden">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/super-admin"
              aria-label="SalaryFlow Admin"
              className="flex shrink-0 items-center gap-2"
            >
              <span className="sm:hidden">
                <SalaryFlowLogo variant="icon" size="sm" label={null} />
              </span>
              <span className="hidden sm:block">
                <SalaryFlowLogo layout="horizontal" size="sm" label={null} />
              </span>
              <span className="hidden rounded-md border px-1.5 py-0.5 text-xs font-medium text-muted-foreground md:inline">
                Admin
              </span>
            </Link>
            <SuperAdminNav />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell items={notifications} viewAllHref="/super-admin/notifications" />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}