"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/services/notification-service";
import { useReadNotifications } from "./use-read-notifications";
import { NotificationGlyph, formatNotificationTime } from "./notification-visuals";

export function NotificationBell({
  items,
  viewAllHref,
}: {
  items: NotificationItem[];
  viewAllHref: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { readIds, unreadCount, markRead, markAllRead } =
    useReadNotifications(items.map((item) => item.id));

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {unreadCount} new
                </span>
              ) : null}
            </div>
            {items.length > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">
                New activity will appear here.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const unread = !readIds.has(item.id);
                return (
                  <li key={item.id} className="border-b last:border-b-0">
                    <Link
                      href={item.href}
                      onClick={() => {
                        markRead(item.id);
                        setOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60 ${
                        unread ? "bg-primary/[0.03]" : ""
                      }`}
                    >
                      <NotificationGlyph category={item.category} tone={item.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`text-sm ${unread ? "font-semibold" : "font-medium"}`}
                          >
                            {item.title}
                          </span>
                          {unread ? (
                            <span
                              className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                              aria-label="Unread"
                            />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {item.description}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t px-4 py-2 text-center">
            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
