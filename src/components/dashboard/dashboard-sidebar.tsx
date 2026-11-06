"use client";

import { useState } from "react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  ArrowDownToLine,
  Banknote,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  Contact,
  HandCoins,
  LayoutDashboard,
  LineChart,
  MapPin,
  Megaphone,
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
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const dashboardNav: NavItem = {
  title: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
};

const employerNavGroups: NavGroup[] = [
  {
    id: "employees",
    label: "Employees",
    items: [
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
        title: "Loan Applications",
        href: "/dashboard/loans/applications",
        icon: HandCoins,
      },
      {
        title: "Loan Products",
        href: "/dashboard/employees/loan-products",
        icon: HandCoins,
      },
      {
        title: "Repayments",
        href: "/dashboard/repayments",
        icon: Banknote,
      },
      {
        title: "Collections",
        href: "/dashboard/collections",
        icon: ShieldAlert,
      },
      {
        title: "Thrift Savings",
        href: "/dashboard/employees/thrift",
        icon: PiggyBank,
      },
    ],
  },
  {
    id: "members",
    label: "Members",
    items: [
      {
        title: "Members",
        href: "/dashboard/members",
        icon: Contact,
      },
      {
        title: "Member Savings",
        href: "/dashboard/members/savings",
        icon: PiggyBank,
      },
      {
        title: "Member Loans",
        href: "/dashboard/members/loans",
        icon: HandCoins,
      },
      {
        title: "Member Loan Product",
        href: "/dashboard/members/loan-products",
        icon: HandCoins,
      },
      {
        title: "Member Repayments",
        href: "/dashboard/members/repayments",
        icon: Banknote,
      },
      {
        title: "Member Collections",
        href: "/dashboard/members/collections",
        icon: ShieldAlert,
      },
      {
        title: "Member Withdrawals",
        href: "/dashboard/members/withdrawals",
        icon: ArrowDownToLine,
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        title: "Funds",
        href: "/dashboard/funds",
        icon: PiggyBank,
      },
      {
        title: "Withdrawals",
        href: "/dashboard/withdrawals",
        icon: Banknote,
      },
      {
        title: "Ledger",
        href: "/dashboard/ledger",
        icon: BookOpen,
      },
    ],
  },
  {
    id: "insights",
    label: "Reports & Audit",
    items: [
      {
        title: "Reports",
        href: "/dashboard/reports",
        icon: LineChart,
      },
      {
        title: "Audit log",
        href: "/dashboard/audit",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "general",
    label: "General",
    items: [
      {
        title: "Notifications",
        href: "/dashboard/notifications",
        icon: Bell,
      },
      {
        title: "Announcements",
        href: "/dashboard/announcements",
        icon: Megaphone,
      },
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

const AUDIT_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "AUDITOR",
  "SUPER_ADMIN",
]);

function SidebarNavigation({
  groups,
  activeHref,
  activeGroupId,
}: {
  groups: NavGroup[];
  activeHref: string | undefined;
  activeGroupId: string | null;
}) {
  const { setOpenMobile } = useSidebar();

  // The parent keys this component by pathname, so a refresh or navigation
  // starts with only the active group expanded.
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    activeGroupId ? [activeGroupId] : []
  );

  function toggleGroup(id: string) {
    setOpenGroups((current) =>
      current.includes(id)
        ? current.filter((group) => group !== id)
        : [...current, id]
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeHref === dashboardNav.href}
                tooltip={dashboardNav.title}
                render={<Link href={dashboardNav.href} />}
                onClick={() => setOpenMobile(false)}
              >
                <dashboardNav.icon />
                <span>{dashboardNav.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {groups.map((group) => {
        const isOpen = openGroups.includes(group.id);
        const contentId = `sidebar-group-${group.id}`;

        return (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel
              render={
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                />
              }
              className="w-full cursor-pointer justify-between gap-2 hover:text-sidebar-foreground"
            >
              <span>{group.label}</span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </SidebarGroupLabel>
            <SidebarGroupContent id={contentId} hidden={!isOpen}>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={item.href === activeHref}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}

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

  const navGroups = employerNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.href !== "/dashboard/audit" ||
          (role ? AUDIT_ROLES.has(role) : false)
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Match the most specific link so nested routes highlight one item only.
  const activeHref = navGroups
    .flatMap((group) => group.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const activeGroupId =
    navGroups.find((group) =>
      group.items.some((item) => item.href === activeHref)
    )?.id ?? null;

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center">
                <SalaryFlowLogo variant="icon" size="md" />
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
        <SidebarNavigation
          key={pathname}
          groups={navGroups}
          activeHref={activeHref}
          activeGroupId={activeGroupId}
        />
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
