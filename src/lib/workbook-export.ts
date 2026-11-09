import * as XLSX from "xlsx";

export interface WorkbookColumn {
  key: string;
  label: string;
  format?: "currency" | "number" | "date" | "datetime";
}

export interface WorkbookSheet {
  sheetName: string;
  title: string;
  subtitle?: string;
  metadata?: Array<[string, string]>;
  columns: WorkbookColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
  generatedAt?: string;
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cellValue(value: unknown, column: WorkbookColumn) {
  if (value === null || value === undefined || value === "") return "";
  if (column.format === "date") return formatDate(value);
  if (column.format === "datetime") return formatDateTime(value);
  if (column.format === "currency" || column.format === "number") {
    const num = Number(value);
    return Number.isFinite(num) ? num : "";
  }
  return String(value);
}

function safeSheetName(name: string) {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "Report").slice(0, 31);
}

function displayWidth(value: unknown, column: WorkbookColumn) {
  if (value === null || value === undefined) return 8;
  if (column.format === "currency") {
    return Math.min(22, Math.max(14, String(Number(value).toFixed(2)).length + 4));
  }
  if (column.format === "date" || column.format === "datetime") return 14;
  return Math.min(40, Math.max(12, String(value).length + 2));
}

/**
 * Build a readable multi-row .xlsx workbook: title, metadata, a clear header,
 * the data, a totals row, sensible column widths and an autofilter.
 */
export function buildWorkbook(sheet: WorkbookSheet): Buffer {
  const columnCount = Math.max(1, sheet.columns.length);
  const generatedAt = sheet.generatedAt ?? new Date().toISOString();
  const aoa: unknown[][] = [];

  aoa.push([sheet.title]);
  aoa.push([sheet.subtitle ?? ""]);
  const metadata = [
    `Generated: ${formatDateTime(generatedAt)}`,
    `Rows: ${sheet.rows.length}`,
    ...(sheet.metadata ?? []).map(([label, value]) => `${label}: ${value}`),
  ];
  aoa.push([metadata.join("  ·  ")]);
  aoa.push([]);
  const headerRowIndex = aoa.length;
  aoa.push(sheet.columns.map((column) => column.label));

  for (const row of sheet.rows) {
    aoa.push(
      sheet.columns.map((column) => cellValue(row[column.key], column))
    );
  }

  const totalKeys = Object.keys(sheet.totals ?? {});
  if (totalKeys.length > 0) {
    const totalRow = sheet.columns.map((column, index) => {
      if (index === 0) return "Total";
      const value = sheet.totals?.[column.key];
      return value === undefined ? "" : Number(value);
    });
    aoa.push(totalRow);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Apply number formats so currency and numeric columns line up and read well.
  const firstDataRow = headerRowIndex + 1;
  const lastDataRow = firstDataRow + sheet.rows.length - 1;
  for (let rowIndex = firstDataRow; rowIndex <= lastDataRow; rowIndex += 1) {
    sheet.columns.forEach((column, columnIndex) => {
      if (column.format !== "currency" && column.format !== "number") return;
      const address = XLSX.utils.encode_cell({
        r: rowIndex,
        c: columnIndex,
      });
      const cell = worksheet[address];
      if (!cell || cell.t !== "n") return;
      cell.z = column.format === "currency" ? "#,##0.00" : "#,##0.00";
    });
  }

  if (totalKeys.length > 0) {
    const totalRowIndex = firstDataRow + sheet.rows.length;
    sheet.columns.forEach((column, columnIndex) => {
      if (!totalKeys.includes(column.key)) return;
      const address = XLSX.utils.encode_cell({
        r: totalRowIndex,
        c: columnIndex,
      });
      const cell = worksheet[address];
      if (cell) cell.z = "#,##0.00";
    });
  }

  worksheet["!cols"] = sheet.columns.map((column) => {
    const lengths = [
      column.label.length + 2,
      ...sheet.rows.map((row) => displayWidth(row[column.key], column)),
    ];
    return { wch: Math.min(40, Math.max(...lengths)) };
  });

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: columnCount - 1 } },
  ];

  if (sheet.rows.length > 0) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: {
          r: firstDataRow + sheet.rows.length - 1,
          c: columnCount - 1,
        },
      }),
    };
  }

  worksheet["!rows"] = [
    { hpt: 24 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 8 },
    { hpt: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    safeSheetName(sheet.sheetName)
  );

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}
