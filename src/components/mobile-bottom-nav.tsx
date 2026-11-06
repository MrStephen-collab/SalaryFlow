"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  Bell,
  HandCoins,
  Home,
  LayoutDashboard,
  PiggyBank,
  Settings,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: typeof Home;
};

const NAVS: Record<"dashboard" | "member" | "employee", NavItem[]> = {
  dashboard: [
    { title: "Home", href: "/dashboard", icon: LayoutDashboard },
    { title: "Loans", href: "/dashboard/loans", icon: HandCoins },
    { title: "Thrift", href: "/dashboard/employees/thrift", icon: PiggyBank },
    { title: "Funds", href: "/dashboard/funds", icon: PiggyBank },
    { title: "Alerts", href: "/dashboard/notifications", icon: Bell },
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
  ],
  member: [
    { title: "Dashboard", href: "/member", icon: Home },
    { title: "Savings", href: "/member/savings", icon: PiggyBank },
    { title: "My Loans", href: "/member/loans", icon: HandCoins },
    { title: "Withdraw", href: "/member/withdrawals", icon: ArrowDownToLine },
    { title: "Alerts", href: "/member/notifications", icon: Bell },
    { title: "Profile", href: "/member/profile", icon: UserCircle2 },
  ],
  employee: [
    { title: "Home", href: "/employee", icon: Home },
    { title: "Money", href: "/employee/money", icon: Wallet },
    { title: "Loans", href: "/employee/loans", icon: HandCoins },
    { title: "Withdraw", href: "/employee/withdrawals", icon: ArrowDownToLine },
    { title: "Profile", href: "/employee/profile", icon: UserCircle2 },
  ],
};

export function MobileBottomNav({
  variant,
}: {
  variant: keyof typeof NAVS;
}) {
  const pathname = usePathname();
  const items = NAVS[variant];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === pathname || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors sm:text-[11px]",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="size-5" />
            <span className="w-full truncate text-center">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
