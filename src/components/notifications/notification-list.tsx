"use client";

import Link from "next/link";
import { CheckCheck, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationItem } from "@/services/notification-service";
import { useReadNotifications } from "./use-read-notifications";
import { NotificationGlyph, formatNotificationTime } from "./notification-visuals";

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const { readIds, unreadCount, markRead, markAllRead } =
    useReadNotifications(items.map((item) => item.id));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "All notifications read"}
            </p>
            <p className="text-xs text-muted-foreground">
              Activity from loans, withdrawals, payroll and deductions.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="size-4" aria-hidden />
            Mark all read
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <BellOff className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              Financial activity will show up here as it happens.
            </p>
          </div>
        ) : (
          <ul>
            {items.map((item) => {
              const unread = !readIds.has(item.id);
              return (
                <li key={item.id} className="border-b last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => markRead(item.id)}
                    className={`flex gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60 ${
                      unread ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    <NotificationGlyph category={item.category} tone={item.tone} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`text-sm ${unread ? "font-semibold" : "font-medium"}`}>
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                      {item.reference ? (
                        <span className="mt-1 block font-mono text-[11px] text-muted-foreground/80">
                          {item.reference}
                        </span>
                      ) : null}
                    </span>
                    {unread ? (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
