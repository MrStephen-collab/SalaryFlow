import XLSX from "xlsx-js-style";

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
  /** Set to false for summary-style sheets that do not need filtering. */
  autofilter?: boolean;
}

const CURRENCY_FORMAT = '"₦"#,##0.00;[Red]-"₦"#,##0.00';
const NUMBER_FORMAT = "#,##0.##";
const DATE_FORMAT = "dd mmm yyyy";
const DATETIME_FORMAT = "dd mmm yyyy, hh:mm";

const palette = {
  ink: "0A0A0A",
  muted: "737373",
  headerBg: "171717",
  headerText: "FAFAFA",
  grid: "D4D4D4",
  band: "F7F7F7",
  totalBg: "EEEEEE",
  totalLine: "171717",
};

interface BorderLine {
  style: "thin" | "medium";
  color: { rgb: string };
}

interface CellBorder {
  top?: BorderLine;
  bottom?: BorderLine;
  left?: BorderLine;
  right?: BorderLine;
}

interface CellStyle {
  font?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  border?: CellBorder;
  numFmt?: string;
}

const thin = (rgb: string): BorderLine => ({ style: "thin", color: { rgb } });

const gridBorder: CellBorder = {
  top: thin(palette.grid),
  bottom: thin(palette.grid),
  left: thin(palette.grid),
  right: thin(palette.grid),
};

const titleStyle: CellStyle = {
  font: { name: "Calibri", sz: 16, bold: true, color: { rgb: palette.ink } },
  alignment: { vertical: "center" },
};

const subtitleStyle: CellStyle = {
  font: { name: "Calibri", sz: 10, color: { rgb: palette.muted } },
  alignment: { vertical: "center" },
};

const metadataStyle: CellStyle = {
  font: { name: "Calibri", sz: 9, color: { rgb: palette.muted } },
  alignment: { vertical: "center", wrapText: true },
};

const headerStyle: CellStyle = {
  font: { name: "Calibri", sz: 11, bold: true, color: { rgb: palette.headerText } },
  fill: { patternType: "solid", fgColor: { rgb: palette.headerBg } },
  alignment: {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  },
  border: gridBorder,
};

const bodyStyles = new Map<string, CellStyle>();

function bodyStyle(
  align: "left" | "right" | "center",
  banded: boolean,
  numFmt?: string
): CellStyle {
  const key = `${align}:${banded ? "band" : "plain"}:${numFmt ?? ""}`;
  const cached = bodyStyles.get(key);
  if (cached) return cached;

  const style: CellStyle = {
    font: { name: "Calibri", sz: 10, color: { rgb: palette.ink } },
    alignment: {
      horizontal: align,
      vertical: "center",
      wrapText: align === "left",
    },
    border: gridBorder,
  };
  if (banded) {
    style.fill = { patternType: "solid", fgColor: { rgb: palette.band } };
  }
  if (numFmt) style.numFmt = numFmt;
  bodyStyles.set(key, style);
  return style;
}

const totalStyles = new Map<string, CellStyle>();

function totalCellStyle(
  align: "left" | "right",
  numFmt?: string
): CellStyle {
  const key = `${align}:${numFmt ?? ""}`;
  const cached = totalStyles.get(key);
  if (cached) return cached;

  const style: CellStyle = {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: palette.ink } },
    fill: { patternType: "solid", fgColor: { rgb: palette.totalBg } },
    alignment: { horizontal: align, vertical: "center" },
    border: {
      top: { style: "medium", color: { rgb: palette.totalLine } },
      bottom: thin(palette.grid),
      left: thin(palette.grid),
      right: thin(palette.grid),
    },
  };
  if (numFmt) style.numFmt = numFmt;
  totalStyles.set(key, style);
  return style;
}

const amountFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 2,
});

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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
    timeZone: "UTC",
  });
}

/**
 * Convert a stored date/datetime into an Excel serial number so the cell is a
 * real, sortable date instead of a block of text.
 */
function toExcelSerial(value: unknown, withTime: boolean): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  let date: Date;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    date = new Date(
      Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    );
  } else {
    date = new Date(text);
  }
  if (Number.isNaN(date.getTime())) return null;

  const ms = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    withTime ? date.getUTCHours() : 0,
    withTime ? date.getUTCMinutes() : 0,
    withTime ? date.getUTCSeconds() : 0
  );
  return ms / 86_400_000 + 25_569;
}

const ACRONYMS = new Set([
  "PAYE",
  "NHF",
  "NHIS",
  "NSITF",
  "ITF",
  "FIRS",
  "CAC",
  "BVN",
  "NIN",
  "KYC",
  "TIN",
  "VAT",
  "NGN",
  "USD",
  "API",
  "URL",
  "PDF",
  "CSV",
  "OTP",
  "PIN",
  "USSD",
  "POS",
]);

function humanize(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 40) return value;

  const isLowerEnum = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(trimmed);
  const isUpperEnum = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(trimmed);
  if (isLowerEnum || isUpperEnum) {
    return trimmed
      .toLowerCase()
      .split("_")
      .map((word, index) =>
        index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
      )
      .join(" ");
  }

  // Title-case single-word state values such as PAID or ACTIVE, but leave
  // acronyms (PAYE, NIN, BVN, ...) and mixed-case names untouched.
  if (/^[A-Z]{4,12}$/.test(trimmed) && !ACRONYMS.has(trimmed)) {
    return trimmed.charAt(0) + trimmed.slice(1).toLowerCase();
  }

  return value;
}

function cellValue(value: unknown, column: WorkbookColumn): unknown {
  if (value === null || value === undefined || value === "") return "";
  if (column.format === "currency" || column.format === "number") {
    const num = Number(value);
    return Number.isFinite(num) ? num : String(value);
  }
  if (column.format === "date" || column.format === "datetime") {
    const serial = toExcelSerial(value, column.format === "datetime");
    return serial ?? formatDate(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return humanize(String(value));
}

function displayText(value: unknown, column: WorkbookColumn): string {
  if (value === null || value === undefined || value === "") return "";
  if (column.format === "currency") {
    const num = Number(value);
    return Number.isFinite(num) ? `₦${amountFormatter.format(num)}` : String(value);
  }
  if (column.format === "number") {
    const num = Number(value);
    return Number.isFinite(num) ? numberFormatter.format(num) : String(value);
  }
  if (column.format === "datetime") return formatDateTime(value);
  if (column.format === "date") return formatDate(value);
  return humanize(String(value));
}

function columnAlignment(column: WorkbookColumn): "left" | "right" | "center" {
  if (column.format === "currency" || column.format === "number") return "right";
  return "left";
}

function numberFormat(column: WorkbookColumn): string | undefined {
  switch (column.format) {
    case "currency":
      return CURRENCY_FORMAT;
    case "number":
      return NUMBER_FORMAT;
    case "date":
      return DATE_FORMAT;
    case "datetime":
      return DATETIME_FORMAT;
    default:
      return undefined;
  }
}

function safeSheetName(name: string) {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "Report").slice(0, 31);
}

function columnWidth(column: WorkbookColumn, rows: Record<string, unknown>[]) {
  let longest = column.label.length;
  for (const row of rows) {
    const length = displayText(row[column.key], column).length;
    if (length > longest) longest = length;
  }

  const minimum =
    column.format === "currency" ? 14 : column.format === "datetime" ? 18 : 10;
  const maximum = column.format === "currency" ? 20 : 46;
  return Math.min(maximum, Math.max(minimum, longest + 2));
}

/**
 * Group metadata into as few lines as the table can comfortably display so long
 * filter lists stay readable instead of being clipped in one merged cell.
 */
function metadataLines(items: string[], maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const item of items) {
    const candidate = current ? `${current}   ·   ${item}` : item;
    if (current && candidate.length > maxChars) {
      lines.push(current);
      current = item;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * Build a readable worksheet: styled title and metadata, a bold table header
 * with sensible column widths, real number/date cells, banded rows, a totals
 * row and an autofilter.
 */
function buildWorksheet(sheet: WorkbookSheet) {
  const columnCount = Math.max(1, sheet.columns.length);
  const generatedAt = sheet.generatedAt ?? new Date().toISOString();
  const rows = sheet.rows;
  const totals = sheet.totals ?? {};

  const widths = sheet.columns.map((column) => columnWidth(column, rows));
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  const columnKeys = new Set(sheet.columns.map((column) => column.key));
  const mappedTotalKeys = Object.keys(totals).filter((key) =>
    columnKeys.has(key)
  );
  const summaryTotals = Object.entries(totals).filter(
    ([key, value]) =>
      !columnKeys.has(key) && Number.isFinite(Number(value))
  );

  const metadataItems = [
    `Generated: ${formatDateTime(generatedAt)}`,
    `${rows.length} ${rows.length === 1 ? "row" : "rows"}`,
    ...(sheet.metadata ?? []).map(([label, value]) => `${label}: ${value}`),
    ...summaryTotals.map(([key, value]) => {
      const label =
        key === "in" ? "Money in" : key === "out" ? "Money out" : humanize(key);
      return `${label}: ₦${amountFormatter.format(Number(value))}`;
    }),
  ];
  const metaLines = metadataLines(metadataItems, Math.max(80, tableWidth));

  const aoa: unknown[][] = [];
  aoa.push([sheet.title]);
  aoa.push([sheet.subtitle ?? ""]);
  for (const line of metaLines) aoa.push([line]);
  aoa.push([]);

  const headerRowIndex = aoa.length;
  aoa.push(sheet.columns.map((column) => column.label));

  for (const row of rows) {
    aoa.push(sheet.columns.map((column) => cellValue(row[column.key], column)));
  }

  const firstDataRow = headerRowIndex + 1;
  const totalRowIndex = mappedTotalKeys.length > 0 ? aoa.length : -1;
  if (totalRowIndex >= 0) {
    aoa.push(
      sheet.columns.map((column, index) => {
        if (index === 0) return "Total";
        if (!mappedTotalKeys.includes(column.key)) return "";
        const value = Number(totals[column.key]);
        return Number.isFinite(value)
          ? Math.round(value * 100) / 100
          : "";
      })
    );
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const lastRow = aoa.length - 1;

  for (let rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
    const isBody =
      rowIndex >= firstDataRow &&
      rowIndex < firstDataRow + rows.length;
    const isTotal = rowIndex === totalRowIndex;
    const isBanded = isBody && (rowIndex - firstDataRow) % 2 === 1;

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({
        r: rowIndex,
        c: columnIndex,
      });
      let cell = worksheet[address];
      if (!cell) {
        cell = { t: "s", v: "" };
        worksheet[address] = cell;
      }

      if (rowIndex === 0) {
        cell.s = titleStyle;
      } else if (rowIndex === 1) {
        cell.s = subtitleStyle;
      } else if (rowIndex >= 2 && rowIndex < headerRowIndex - 1) {
        cell.s = metadataStyle;
      } else if (rowIndex === headerRowIndex) {
        cell.s = headerStyle;
      } else if (isTotal) {
        const column = sheet.columns[columnIndex];
        cell.s = totalCellStyle(
          columnIndex === 0 ? "left" : "right",
          columnIndex === 0 || !column ? undefined : numberFormat(column)
        );
      } else if (isBody) {
        const column = sheet.columns[columnIndex];
        const align =
          cell.t === "n" && !column.format
            ? "right"
            : columnAlignment(column);
        cell.s = bodyStyle(align, isBanded, numberFormat(column));
      }
    }
  }

  worksheet["!cols"] = widths.map((width) => ({ wch: width }));
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
    ...metaLines.map((_, index) => ({
      s: { r: 2 + index, c: 0 },
      e: { r: 2 + index, c: columnCount - 1 },
    })),
  ];

  if (sheet.autofilter !== false && rows.length > 0) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: { r: firstDataRow + rows.length - 1, c: columnCount - 1 },
      }),
    };
  }

  const rowInfo: XLSX.RowInfo[] = [];
  rowInfo[0] = { hpt: 28 };
  rowInfo[1] = { hpt: 16 };
  metaLines.forEach((line, index) => {
    const lines = Math.max(
      1,
      Math.ceil(line.length / Math.max(60, tableWidth))
    );
    rowInfo[2 + index] = { hpt: 13 * lines + 3 };
  });
  rowInfo[headerRowIndex - 1] = { hpt: 6 };
  rowInfo[headerRowIndex] = { hpt: 28 };

  rows.forEach((row, index) => {
    let lines = 1;
    sheet.columns.forEach((column, columnIndex) => {
      const text = displayText(row[column.key], column);
      if (!text) return;
      const perLine = Math.max(8, widths[columnIndex] - 2);
      lines = Math.max(lines, Math.ceil(text.length / perLine));
    });
    rowInfo[firstDataRow + index] = {
      hpt: Math.min(78, Math.max(18, lines * 13 + 5)),
    };
  });

  if (totalRowIndex >= 0) rowInfo[totalRowIndex] = { hpt: 22 };
  worksheet["!rows"] = rowInfo;

  worksheet["!margins"] = {
    left: 0.4,
    right: 0.4,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3,
  };

  return worksheet;
}

/**
 * Build one workbook containing one or more styled worksheets.
 */
export function buildWorkbooks(sheets: WorkbookSheet[]): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildWorksheet(sheet),
      safeSheetName(sheet.sheetName)
    );
  }

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function buildWorkbook(sheet: WorkbookSheet): Buffer {
  return buildWorkbooks([sheet]);
}
