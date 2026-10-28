"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

function flattenRows(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenRows(
        (child.props as { children?: React.ReactNode }).children,
      );
    }
    return [child];
  });
}

type CollapsibleTableBodyProps = React.ComponentProps<typeof TableBody> & {
  /** Number of columns in the table, used so the toggle spans the full row. */
  columns: number;
  /** Number of rows to show before collapsing. Defaults to 10. */
  limit?: number;
  /** Plural noun used in the toggle label, e.g. "repayments". */
  itemLabel?: string;
};

/**
 * A table body that collapses long result sets.
 *
 * Tables with `limit` rows or fewer render normally. Longer tables show the
 * first `limit` rows with a "Show all" toggle so pages stay compact.
 */
export function CollapsibleTableBody({
  children,
  columns,
  limit = 10,
  itemLabel = "rows",
  className,
  ...props
}: CollapsibleTableBodyProps) {
  const [expanded, setExpanded] = React.useState(false);
  const rows = React.useMemo(() => flattenRows(children), [children]);
  const hasMore = rows.length > limit;
  const visibleRows = hasMore && !expanded ? rows.slice(0, limit) : rows;
  const hiddenCount = rows.length - limit;

  return (
    <TableBody className={className} {...props}>
      {visibleRows}
      {hasMore ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns} className="py-2 text-center">
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
                  <ChevronUp className="size-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" />
                  Show all {rows.length} {itemLabel}
                  <span className="sr-only"> ({hiddenCount} hidden)</span>
                </>
              )}
            </Button>
          </TableCell>
        </TableRow>
      ) : null}
    </TableBody>
  );
}
