"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import type { SalaryRecord } from "@/services/salary-service";
import { Search } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusVariant(status: string) {
  switch (status) {
    case "PAID":
    case "APPROVED":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

/** Salary records table with a live employee search (name or number). */
export function SalaryRecordsTable({ records }: { records: SalaryRecord[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => {
      const name = (record.employee_name ?? "").toLowerCase();
      const number = (record.employee_number ?? "").toLowerCase();
      const department = (record.department ?? "").toLowerCase();
      return (
        name.includes(term) ||
        number.includes(term) ||
        department.includes(term)
      );
    });
  }, [records, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employee name, number or department"
            className="pl-8"
            aria-label="Search salary records"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {records.length} records
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>No.</TableHead>
              <TableHead>Basic</TableHead>
              <TableHead>Allowances</TableHead>
              <TableHead>Loan Ded.</TableHead>
              <TableHead>Other Ded.</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <CollapsibleTableBody columns={8} itemLabel="salary records">
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <p className="text-sm font-medium">No matching records</p>
                  <p className="text-sm text-muted-foreground">
                    Try another name or employee number.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.employee_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.employee_number}
                  </TableCell>
                  <TableCell>{naira(record.basic_salary)}</TableCell>
                  <TableCell>{naira(record.allowances)}</TableCell>
                  <TableCell>{naira(record.loan_deductions)}</TableCell>
                  <TableCell>{naira(record.other_deductions)}</TableCell>
                  <TableCell className="font-medium">
                    {naira(record.net_salary)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(record.status)}>
                      {record.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </CollapsibleTableBody>
        </Table>
      </div>
    </div>
  );
}
