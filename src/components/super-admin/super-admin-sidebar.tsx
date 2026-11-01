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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  BadgeCheck,
  Bell,
  Building2,
  LayoutDashboard,
  Plug,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { APP_NAME } from "@/config/constants";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";

const platformNav = [
  { title: "Overview", href: "/super-admin", icon: LayoutDashboard },
  { title: "Organizations", href: "/super-admin/organizations", icon: Building2 },
  { title: "Plans", href: "/super-admin/plans", icon: BadgeCheck },
  { title: "Integrations", href: "/super-admin/integrations", icon: Plug },
  { title: "Notifications", href: "/super-admin/notifications", icon: Bell },
];

export function SuperAdminSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const initials = (user.user_metadata?.full_name ?? user.email ?? "SA")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/super-admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center">
                <SalaryFlowLogo variant="icon" size="md" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{APP_NAME}</span>
                <span className="text-xs text-muted-foreground">
                  Platform owner
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformNav.map((item) => {
                const isActive =
                  item.href === "/super-admin"
                    ? pathname === "/super-admin"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                      onClick={() => setOpenMobile(false)}
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
                  {user.user_metadata?.full_name ?? "Super Admin"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <ThemeToggle />
              <SignOutButton />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
