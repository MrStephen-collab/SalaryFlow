"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileDown } from "lucide-react";

export interface ReportFilterOptions {
  reportKey: string;
  supportsStatus: boolean;
  statusOptions: string[];
  supportsProduct: boolean;
  supportsDepartment: boolean;
  supportsBranch: boolean;
  supportsEmployee: boolean;
  dateLabel: string;
  departments: string[];
  branches: string[];
  products: { id: string; name: string }[];
  values: {
    startDate?: string;
    endDate?: string;
    department?: string;
    branch?: string;
    employee?: string;
    productId?: string;
    status?: string;
  };
}

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function ReportFilters({
  options,
}: {
  options: ReportFilterOptions;
}) {
  const [filters, setFilters] = useState(options.values);

  const set = (key: keyof ReportFilterOptions["values"]) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <form method="get" className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              From ({options.dateLabel.toLowerCase()})
            </label>
            <Input
              type="date"
              name="startDate"
              value={filters.startDate ?? ""}
              onChange={set("startDate")}
              className="md:text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              To ({options.dateLabel.toLowerCase()})
            </label>
            <Input
              type="date"
              name="endDate"
              value={filters.endDate ?? ""}
              onChange={set("endDate")}
              className="md:text-sm"
            />
          </div>
          {options.supportsDepartment && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Department
              </label>
              <select
                name="department"
                value={filters.department ?? ""}
                onChange={set("department")}
                className={selectClass}
              >
                <option value="">All departments</option>
                {options.departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          {options.supportsBranch && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Branch
              </label>
              <select
                name="branch"
                value={filters.branch ?? ""}
                onChange={set("branch")}
                className={selectClass}
              >
                <option value="">All branches</option>
                {options.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
          {options.supportsProduct && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Loan Product
              </label>
              <select
                name="product"
                value={filters.productId ?? ""}
                onChange={set("productId")}
                className={selectClass}
              >
                <option value="">All products</option>
                {options.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {options.supportsEmployee && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Employee (# or name)
              </label>
              <Input
                type="text"
                name="employee"
                value={filters.employee ?? ""}
                onChange={set("employee")}
                placeholder="Search employee"
                className="md:text-sm"
              />
            </div>
          )}
          {options.supportsStatus && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                name="status"
                value={filters.status ?? ""}
                onChange={set("status")}
                className={selectClass}
              >
                <option value="">All statuses</option>
                {options.statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" variant="default">
            <RefreshCw className="size-4" />
            Apply filters
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            form="report-export-form"
          >
            <FileDown className="size-4" />
            Export Excel
          </Button>
        </div>

        <input type="hidden" name="report" value={options.reportKey} />
      </form>

      <form
        id="report-export-form"
        method="post"
        action="/api/reports/export"
        className="hidden"
      >
        <input type="hidden" name="report" value={options.reportKey} />
        <input type="hidden" name="startDate" value={filters.startDate ?? ""} />
        <input type="hidden" name="endDate" value={filters.endDate ?? ""} />
        <input
          type="hidden"
          name="department"
          value={filters.department ?? ""}
        />
        <input type="hidden" name="branch" value={filters.branch ?? ""} />
        <input type="hidden" name="employee" value={filters.employee ?? ""} />
        <input type="hidden" name="product" value={filters.productId ?? ""} />
        <input type="hidden" name="status" value={filters.status ?? ""} />
      </form>
    </>
  );
}