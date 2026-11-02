"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the employer dashboard fresh without a manual reload. Server components
 * re-fetch their data whenever the router refreshes.
 */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
