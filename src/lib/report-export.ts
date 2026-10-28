import type { ReportData, ReportColumn } from "@/services/report-service";

export function formatDate(value: string | number | Date): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function excelCellContent(value: unknown, column?: ReportColumn): string {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  if (column?.format === "currency" || column?.format === "number") {
    if (Number.isFinite(num) && String(value).trim() !== "") {
      return `<td style="mso-number-format:'\\#,##0.00'">${num.toFixed(2)}</td>`;
    }
    return "<td></td>";
  }
  if (column?.format === "datetime" || column?.format === "date") {
    return `<td style="mso-number-format:'dd-mmm-yyyy'">${escapeHtml(
      formatDate(String(value))
    )}</td>`;
  }
  return `<td>${escapeHtml(value)}</td>`;
}

export function buildExcelWorkbook(
  report: ReportData,
  extra: { generatedAt: string }
): string {
  const columns = report.columns;
  const headerRow = columns
    .map((c) => `<th>${escapeHtml(c.label)}</th>`)
    .join("");

  const bodyRows = report.rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => excelCellContent(row[c.key], c))
          .join("")}</tr>`
    )
    .join("");

  const totalKeys = Object.keys(report.totals);

  const totalsRow =
    totalKeys.length > 0
      ? `<tr>${columns
          .map((c, index) => {
            if (index === 0) return "<td><b>Total</b></td>";
            const value = report.totals[c.key];
            if (value !== undefined) {
              return `<td style="mso-number-format:'\\#,##0.00'"><b>${value.toFixed(
                2
              )}</b></td>`;
            }
            return "<td></td>";
          })
          .join("")}</tr>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook>
  <x:ExcelWorksheets>
    <x:ExcelWorksheet>
      <x:Name>${escapeHtml(report.title)}</x:Name>
      <x:WorksheetOptions>
        <x:DisplayGridlines/>
        <x:AutoFilter x:Range="A1:Z1"/>
      </x:WorksheetOptions>
    </x:ExcelWorksheet>
  </x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table { border-collapse: collapse; }
  th { background: #d1d5db; border: 1px solid #9ca3af; padding: 4px 8px; font-weight: bold; }
  td { border: 1px solid #9ca3af; padding: 4px 8px; }
  h1, p { font-family: Calibri, sans-serif; }
</style>
</head>
<body>
<h1>${escapeHtml(report.title)}</h1>
<p>Generated: ${escapeHtml(formatDateTime(extra.generatedAt))} - ${report.rows.length} rows</p>
<table>
<tr>${headerRow}</tr>
${bodyRows}
${totalsRow}
</table>
</body>
</html>`;
}

export function reportFileName(report: ReportData): string {
  const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug}-${new Date().toISOString().slice(0, 10)}.xls`;
}