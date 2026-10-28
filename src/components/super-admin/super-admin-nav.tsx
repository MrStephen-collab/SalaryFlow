"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/super-admin", label: "Overview", exact: true },
  { href: "/super-admin/organizations", label: "Organizations", exact: false },
  { href: "/super-admin/plans", label: "Plans", exact: false },
  { href: "/super-admin/notifications", label: "Notifications", exact: false },
];

export function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}