import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { cn } from "@/lib/utils";

export interface SalaryFlowLoaderProps {
  /** Honest, non-transactional status copy. Keep it to what is actually happening. */
  status?: string;
  /** Render inline instead of covering the viewport. */
  inline?: boolean;
  className?: string;
}

/**
 * Full-screen branded loading scene. The progress line is indeterminate, so it
 * never implies a real percentage or a completed transaction.
 */
export function SalaryFlowLoader({
  status = "Preparing your workspace...",
  inline = false,
  className,
}: SalaryFlowLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex flex-col items-center justify-center gap-8 overflow-hidden bg-[linear-gradient(145deg,#071A2F_0%,#102A43_55%,#08182B_100%)] px-6 text-white",
        inline ? "min-h-[320px] rounded-xl" : "fixed inset-0 z-50 min-h-dvh",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-1/4 size-72 rounded-full bg-teal-400/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-7">
        <SalaryFlowLogo variant="light" size="xl" animated />
        <div className="h-1 w-56 max-w-full overflow-hidden rounded-full bg-white/15">
          <div className="sf-loader-bar h-full w-2/5 rounded-full bg-[linear-gradient(90deg,#2DD4BF,#22D3EE,#60A5FA)]" />
        </div>
        <p className="text-center text-sm text-white/70">{status}</p>
      </div>
    </div>
  );
}
