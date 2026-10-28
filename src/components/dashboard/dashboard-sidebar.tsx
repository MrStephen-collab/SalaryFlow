"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  HandCoins,
  LayoutDashboard,
  LineChart,
  MapPin,
  Percent,
  PiggyBank,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { NotificationItem } from "@/services/notification-service";
import { APP_NAME } from "@/config/constants";

const employerNav = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Employees",
    href: "/dashboard/employees",
    icon: Users,
  },
  {
    title: "Departments",
    href: "/dashboard/employees/departments",
    icon: Building2,
  },
  {
    title: "Branches",
    href: "/dashboard/employees/branches",
    icon: MapPin,
  },
  {
    title: "Salary",
    href: "/dashboard/salary",
    icon: FileText,
  },
  {
    title: "Loans",
    href: "/dashboard/loans",
    icon: HandCoins,
  },
  {
    title: "Repayments",
    href: "/dashboard/repayments",
    icon: Banknote,
  },
  {
    title: "Deductions",
    href: "/dashboard/deductions",
    icon: Percent,
  },
  {
    title: "Reconciliation",
    href: "/dashboard/deductions/reconciliation",
    icon: ClipboardCheck,
  },
  {
    title: "Collections",
    href: "/dashboard/collections",
    icon: ShieldAlert,
  },
  {
    title: "Ledger",
    href: "/dashboard/ledger",
    icon: BookOpen,
  },
  {
    title: "Withdrawals",
    href: "/dashboard/withdrawals",
    icon: Banknote,
  },
  {
    title: "Funds",
    href: "/dashboard/funds",
    icon: PiggyBank,
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: LineChart,
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
  },
  {
    title: "Audit log",
    href: "/dashboard/audit",
    icon: ShieldCheck,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

const AUDIT_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "AUDITOR",
  "SUPER_ADMIN",
]);

export function DashboardSidebar({
  user,
  role,
  notifications,
}: {
  user: User;
  role: string | null;
  notifications: NotificationItem[];
}) {
  const pathname = usePathname();
  const initials = (user.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  const navItems = employerNav.filter(
    (item) =>
      item.href !== "/dashboard/audit" || (role ? AUDIT_ROLES.has(role) : false)
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-bold">SF</span>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{APP_NAME}</span>
                <span className="text-xs text-muted-foreground">Employer</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 rounded-lg p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user.user_metadata?.avatar_url ?? ""}
                  alt={user.email ?? ""}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {user.user_metadata?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <ThemeToggle />
              <NotificationBell items={notifications} viewAllHref="/dashboard/notifications" />
              <LogoutButton />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
