"use client";

import * as React from "react";

import { Pagination } from "@/components/ui/pagination";

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
  /** Number of items per page. Defaults to 10. */
  limit?: number;
  /** Plural noun used in the pagination summary, e.g. "loans". */
  itemLabel?: string;
  className?: string;
};

/**
 * A card-style list with client-side pagination. Long result sets are split
 * into pages instead of expanding into one very long list.
 */
export function CollapsibleList({
  children,
  limit = 10,
  itemLabel = "items",
  className,
}: CollapsibleListProps) {
  const [page, setPage] = React.useState(1);
  const items = React.useMemo(() => flattenItems(children), [children]);
  const pageCount = Math.max(1, Math.ceil(items.length / limit));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * limit;
  const visibleItems = items.slice(start, start + limit);

  return (
    <div className={className}>
      {visibleItems}
      {pageCount > 1 ? (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          totalItems={items.length}
          pageSize={limit}
          onPageChange={setPage}
          itemLabel={itemLabel}
          className="col-span-full pt-2"
        />
      ) : null}
    </div>
  );
}
