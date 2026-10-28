"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

function flattenItems(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenItems(
        (child.props as { children?: React.ReactNode }).children,
      );
    }
    return [child];
  });
}

type CollapsibleListProps = {
  children: React.ReactNode;
  /** Number of items to show before collapsing. Defaults to 10. */
  limit?: number;
  /** Plural noun used in the toggle label, e.g. "loans". */
  itemLabel?: string;
  className?: string;
};

/** A card-style list that collapses long result sets behind a "Show all" toggle. */
export function CollapsibleList({
  children,
  limit = 10,
  itemLabel = "items",
  className,
}: CollapsibleListProps) {
  const [expanded, setExpanded] = React.useState(false);
  const items = React.useMemo(() => flattenItems(children), [children]);
  const hasMore = items.length > limit;
  const visibleItems = hasMore && !expanded ? items.slice(0, limit) : items;

  return (
    <div className={className}>
      {visibleItems}
      {hasMore ? (
        <div className="pt-2 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                <ChevronUp className="size-4" aria-hidden />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="size-4" aria-hidden />
                Show all {items.length} {itemLabel}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
