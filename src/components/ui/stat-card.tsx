import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const statAccents = {
  slate: "from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900",
  blue: "from-blue-500 to-indigo-600",
  emerald: "from-emerald-500 to-teal-600",
  amber: "from-amber-500 to-orange-600",
  rose: "from-rose-500 to-pink-600",
  violet: "from-violet-500 to-purple-600",
  cyan: "from-cyan-500 to-sky-600",
} as const;

export type StatAccent = keyof typeof statAccents;

type StatCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  href?: string;
  accent?: StatAccent;
  delay?: number;
  className?: string;
  size?: "default" | "compact";
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  href,
  accent = "slate",
  delay = 0,
  className,
  size = "default",
}: StatCardProps) {
  const compact = size === "compact";
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/40 sm:p-5",
        compact &&
          "rounded-xl p-2.5 shadow-md hover:-translate-y-0.5 sm:p-3",
        statAccents[accent]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/20 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <div className="pointer-events-none absolute -bottom-14 -left-8 size-28 rounded-full bg-black/10 blur-xl" />

      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30 backdrop-blur-sm sm:size-11",
            compact && "size-8 sm:size-8"
          )}
        >
          <Icon className={cn("size-4 sm:size-5", compact && "size-4")} />
        </div>
        {href && (
          <ArrowUpRight
            className={cn(
              "size-4 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:size-5",
              compact && "size-3.5 sm:size-3.5"
            )}
          />
        )}
      </div>

      <div className={cn("relative mt-2.5 sm:mt-4", compact && "mt-2 sm:mt-2.5")}>
        <p
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider text-white/75 sm:text-xs",
            compact && "text-[9px] sm:text-[10px]"
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-base font-bold tracking-tight sm:text-2xl",
            compact && "text-lg sm:text-xl"
          )}
        >
          {value}
        </p>
        {description && (
          <p
            className={cn(
              "mt-0.5 text-[11px] text-white/85 sm:text-xs",
              compact && "text-[10px]"
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );

  const classes = cn("animate-fade-up", className);

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          "block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}