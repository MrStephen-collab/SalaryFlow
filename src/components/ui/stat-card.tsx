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
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/40",
        statAccents[accent]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/20 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <div className="pointer-events-none absolute -bottom-14 -left-8 size-28 rounded-full bg-black/10 blur-xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
          <Icon className="size-5" />
        </div>
        {href && (
          <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        )}
      </div>

      <div className="relative mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/75">
          {title}
        </p>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight">
          {value}
        </p>
        {description && (
          <p className="mt-1 text-xs text-white/85">{description}</p>
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