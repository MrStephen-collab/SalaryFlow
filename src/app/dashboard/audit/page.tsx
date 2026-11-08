import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  AUDIT_ENTITY_LABELS,
  AuditService,
  type AuditLogRow,
} from "@/services/audit-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";

export const metadata: Metadata = {
  title: "Audit log",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function Details({ row }: { row: AuditLogRow }) {
  if (!row.before && !row.after) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs font-medium text-primary">
        View
      </summary>
      <pre className="mt-2 max-h-56 max-w-md overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed">
        {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
      </pre>
    </details>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const service = await AuditService.create();

  if (!service.canViewAuditLog()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const page = Math.max(1, Number(read("page")) || 1);
  const entityType = read("entity");
  const search = read("q");
  const from = read("from");
  const to = read("to");

  const result = await service.list({
    page,
    pageSize: 25,
    entityType,
    search,
    from,
    to,
  });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (entityType) query.set("entity", entityType);
    if (search) query.set("q", search);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    query.set("page", String(target));
    return `/dashboard/audit?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Append-only record of financial and administrative changes in your organization.
          </p>
        </div>
        <Badge variant="secondary">{result.total.toLocaleString()} events</Badge>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex min-w-52 flex-1 flex-col gap-1.5">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Action
              </label>
              <Input
                id="q"
                name="q"
                placeholder="e.g. approved, disbursed"
                defaultValue={search ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="entity" className="text-xs font-medium text-muted-foreground">
                Entity
              </label>
              <select
                id="entity"
                name="entity"
                defaultValue={entityType ?? ""}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">All entities</option>
                {Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from" className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to" className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button variant="ghost" size="sm" render={<Link href="/dashboard/audit" />}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody
              columns={5}
              itemLabel="events"
              limit={result.pageSize}
            >
              {result.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No audit events match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{row.actorName}</div>
                      {row.actorEmail && row.actorEmail !== row.actorName ? (
                        <div className="text-xs text-muted-foreground">{row.actorEmail}</div>
                      ) : null}
                      {row.ipAddress ? (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {row.ipAddress}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.actionLabel}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {row.action}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.entityLabel}</Badge>
                      {row.entityId ? (
                        <div className="mt-1 max-w-40 truncate font-mono text-[11px] text-muted-foreground">
                          {row.entityId}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Details row={row} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </CollapsibleTableBody>
          </Table>
        </CardContent>
      </Card>

      {result.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </p>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Button variant="outline" size="sm" render={<Link href={pageHref(result.page - 1)} />}>
                Previous
              </Button>
            ) : null}
            {result.page < result.totalPages ? (
              <Button variant="outline" size="sm" render={<Link href={pageHref(result.page + 1)} />}>
                Next
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
