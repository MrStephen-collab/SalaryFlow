import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { SuperAdminNav } from "@/components/super-admin/super-admin-nav";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background print:hidden">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <p className="font-semibold">SalaryFlow Admin</p>
            <SuperAdminNav />
          </div>
          <div className="flex items-center gap-1">
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