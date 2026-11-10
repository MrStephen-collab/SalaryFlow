import type { ReportData, ReportColumn } from "@/services/report-service";
import { buildWorkbook } from "./workbook-export";

export function formatDate(value: string | number | Date): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string | number | Date): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(
    amount
  );
}

export function formatCellValue(
  value: unknown,
  column?: ReportColumn
): string {
  if (value === null || value === undefined) return "";
  if (column?.format === "currency") {
    const num = Number(value);
    return Number.isFinite(num) ? formatCurrency(num) : String(value);
  }
  if (column?.format === "number") {
    const num = Number(value);
    if (Number.isFinite(num)) return formatAmount(num);
  }
  if (column?.format === "datetime") {
    return formatDateTime(String(value));
  }
  if (column?.format === "date") {
    return formatDate(String(value));
  }
  return String(value);
}

export function buildExcelWorkbook(
  report: ReportData,
  extra: { generatedAt: string; filters?: Array<[string, string]> }
): Buffer {
  return buildWorkbook({
    sheetName: report.title,
    title: report.title,
    subtitle: "SalaryFlow report",
    metadata: extra.filters ?? [],
    columns: report.columns.map((column) => ({
      key: column.key,
      label: column.label,
      format: column.format,
    })),
    rows: report.rows,
    totals: report.totals,
    generatedAt: extra.generatedAt,
  });
}

export function reportFileName(report: ReportData): string {
  const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}