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
  ArrowDownToLine,
  Banknote,
  Bell,
  FileText,
  HandCoins,
  Home,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/employee/sign-out-button";
import { APP_NAME } from "@/config/constants";

const employeeNav = [
  { title: "Dashboard", href: "/employee", icon: Home },
  { title: "Salary", href: "/employee/salary", icon: Banknote },
  { title: "Money", href: "/employee/money", icon: Wallet },
  { title: "Withdrawals", href: "/employee/withdrawals", icon: ArrowDownToLine },
  { title: "Loans", href: "/employee/loans", icon: HandCoins },
  { title: "Statement", href: "/employee/statement", icon: FileText },
  { title: "Notifications", href: "/employee/notifications", icon: Bell },
  { title: "Profile", href: "/employee/profile", icon: UserCircle2 },
];

export function EmployeeSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const initials = (user.user_metadata?.full_name ?? user.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/employee" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-bold">SF</span>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{APP_NAME}</span>
                <span className="text-xs text-muted-foreground">Employee</span>
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
              {employeeNav.map((item) => {
                const isActive =
                  item.href === "/employee"
                    ? pathname === "/employee"
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
                  {user.user_metadata?.full_name ?? "User"}
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
