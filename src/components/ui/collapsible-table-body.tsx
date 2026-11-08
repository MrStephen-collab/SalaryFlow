"use client";

import * as React from "react";

import { Pagination } from "@/components/ui/pagination";
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
  /** Number of columns in the table, used so the pagination spans the full row. */
  columns: number;
  /** Number of rows per page. Defaults to 10. */
  limit?: number;
  /** Plural noun used in the pagination summary, e.g. "repayments". */
  itemLabel?: string;
};

/**
 * A table body with client-side pagination. Long result sets are split into
 * pages and the page controls live in a footer row, keeping tables compact.
 */
export function CollapsibleTableBody({
  children,
  columns,
  limit = 10,
  itemLabel = "rows",
  className,
  ...props
}: CollapsibleTableBodyProps) {
  const [page, setPage] = React.useState(1);
  const rows = React.useMemo(() => flattenRows(children), [children]);
  const pageCount = Math.max(1, Math.ceil(rows.length / limit));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * limit;
  const visibleRows = rows.slice(start, start + limit);

  return (
    <TableBody className={className} {...props}>
      {visibleRows}
      {pageCount > 1 ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns} className="py-2">
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              totalItems={rows.length}
              pageSize={limit}
              onPageChange={setPage}
              itemLabel={itemLabel}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </TableBody>
  );
}
