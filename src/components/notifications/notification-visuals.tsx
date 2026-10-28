import {
  Banknote,
  Building2,
  ClipboardCheck,
  FileText,
  HandCoins,
  Percent,
} from "lucide-react";
import type { NotificationCategory, NotificationTone } from "@/services/notification-service";

const TONE_CLASSES: Record<NotificationTone, string> = {
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

const CATEGORY_ICONS: Record<NotificationCategory, typeof Banknote> = {
  loan: HandCoins,
  withdrawal: Banknote,
  payroll: FileText,
  deduction: Percent,
  approval: ClipboardCheck,
  system: Building2,
};

export function NotificationGlyph({
  category,
  tone,
}: {
  category: NotificationCategory;
  tone: NotificationTone;
}) {
  const Icon = CATEGORY_ICONS[category] ?? FileText;

  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
