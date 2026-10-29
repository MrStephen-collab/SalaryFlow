import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { cn } from "@/lib/utils";

/**
 * Quiet route-level placeholder. Deliberately static (no entrance animation) so
 * ordinary in-app navigation never replays the branded intro.
 */
export function SalaryFlowPageSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className={cn("flex flex-col gap-4 lg:gap-6", className)}
    >
      <div className="flex items-center gap-3">
        <SalaryFlowLogo variant="icon" size="md" label={null} />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted/70" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-32 animate-pulse rounded bg-muted/80" />
            <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted/60" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted/70" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-5 py-4">
              <div className="size-8 animate-pulse rounded-full bg-muted/70" />
              <div className="h-3 flex-1 animate-pulse rounded bg-muted/60" />
              <div className="hidden h-3 w-24 animate-pulse rounded bg-muted/50 sm:block" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
