"use client";

/**
 * Scrolling employer announcements for the member/employee portal header.
 * Rendered between the menu button and the account controls.
 */
export function AnnouncementTicker({ messages }: { messages: string[] }) {
  if (!messages.length) return null;

  const text = messages.join("   •   ");

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden"
      aria-label="Announcements"
    >
      <div className="animate-announcement flex w-max whitespace-nowrap">
        <span className="px-4 text-xs font-medium text-muted-foreground">
          📢 {text}
        </span>
        <span
          className="px-4 text-xs font-medium text-muted-foreground"
          aria-hidden="true"
        >
          📢 {text}
        </span>
      </div>
    </div>
  );
}
