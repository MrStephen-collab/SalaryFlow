"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

export interface BackLinkProps extends Omit<LinkProps, "href"> {
  /**
   * Where to go when there is no in-app history to return to (for example when
   * a page was opened directly from a shared link). This is never the landing
   * page for in-app back buttons.
   */
  href: string;
}

/**
 * A back link that returns to the previous page instead of jumping to a fixed
 * destination. When there is no history it falls back to `href`.
 */
export function BackLink({ href, onClick, ...props }: BackLinkProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (typeof window !== "undefined" && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
