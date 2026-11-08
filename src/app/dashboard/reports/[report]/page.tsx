import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireUser,
} from "@/lib/auth";
import {
  getReportMeta,
  ReportService,
  type ReportOptions,
} from "@/services/report-service";
import {
  formatCellValue,
  formatCurrency,
} from "@/lib/report-export";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { ReportFilters } from "@/components/dashboard/reports/report-filters";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Report",
};

interface PageProps {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function paramValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ReportPage({
  params,
  searchParams,
}: PageProps) {
  await requireUser();
  const { report: reportKey } = await params;
  const search = await searchParams;

  const meta = getReportMeta(reportKey);
  if (!meta) notFound();

  const options: ReportOptions = {
    startDate: paramValue(search.startDate),
    endDate: paramValue(search.endDate),
    department: paramValue(search.department),
    branch: paramValue(search.branch),
    employee: paramValue(search.employee),
    productId: paramValue(search.product),
    status: paramValue(search.status),
  };

  const service = await ReportService.create();
  const [departments, branches, products, report] = await Promise.all([
    service.listDepartments(),
    service.listBranches(),
    service.listProducts(),
    service.runReport(reportKey, options),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/reports"
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All reports
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.description}
          </p>
        </div>
        <Button type="submit" variant="outline" size="sm" form="report-export-form">
          <Download className="size-4" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportFilters
            options={{
              reportKey,
              supportsStatus: meta.supportsStatus,
              statusOptions: meta.statusOptions ?? [],
              supportsProduct: meta.supportsProduct,
              supportsDepartment: meta.supportsDepartment,
              supportsBranch: meta.supportsBranch,
              supportsEmployee: meta.supportsEmployee,
              dateLabel: meta.dateLabel,
              departments,
              branches,
              products,
              values: {
                startDate: options.startDate,
                endDate: options.endDate,
                department: options.department,
                branch: options.branch,
                employee: options.employee,
                productId: options.productId,
                status: options.status,
              },
            }}
          />
        </CardContent>
      </Card>

      {Object.keys(report.totals).length > 0 && (
        <div className="flex flex-wrap gap-4">
          {Object.entries(report.totals).map(([key, value]) => (
            <Card key={key} className="min-w-40">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground capitalize">
                  Total {key.replaceAll(/([a-z])([A-Z])/g, "$1 $2")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(Number(value))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-md border">
        {report.rows.length === 0 ? (
          <Card className="border-0">
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium">No records found</p>
              <p className="text-sm text-muted-foreground">
                Adjust your filters and try again.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {report.columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className="whitespace-nowrap"
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <CollapsibleTableBody
                columns={report.columns.length}
                itemLabel="records"
              >
                {report.rows.map((row, index) => (
                  <TableRow key={index}>
                    {report.columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={
                          column.format === "currency"
                            ? "whitespace-nowrap tabular-nums text-right"
                            : "whitespace-nowrap"
                        }
                      >
                        {formatCellValue(row[column.key], column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </CollapsibleTableBody>
              {Object.keys(report.totals).length > 0 ? (
                <TableFooter>
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>
                      <span className="font-semibold">
                        Total ({report.rows.length} rows)
                      </span>
                    </TableCell>
                    {report.columns.slice(1).map((column) => {
                      const value = report.totals[column.key];
                      return (
                        <TableCell
                          key={column.key}
                          className={
                            column.format === "currency"
                              ? "font-semibold tabular-nums text-right"
                              : "font-semibold"
                          }
                        >
                          {value !== undefined
                            ? formatCurrency(Number(value))
                            : ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}