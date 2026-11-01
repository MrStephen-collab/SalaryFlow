import * as XLSX from "xlsx";
import { parseCsv } from "./csv";

export interface ParsedSalaryRow {
  employeeNumber: string;
  employeeName: string;
  basicSalary: number;
  allowances: number;
  otherDeductions: number;
}

export interface SalaryFileResult {
  rows: ParsedSalaryRow[];
  error?: string;
  note?: string;
}

const normalize = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) =>
    aliases.some((alias) => header.includes(alias))
  );
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/**
 * Parse a salary file. Supports CSV/TXT and Excel (.xlsx/.xls) with flexible
 * headers so bank payment schedules (Beneficiary Name / Amount / Staff ID) work
 * as well as the standard SalaryFlow template.
 */
export async function parseSalaryFile(file: File): Promise<SalaryFileResult> {
  let matrix: unknown[][] = [];

  try {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
    } else {
      matrix = parseCsv(await file.text());
    }
  } catch {
    return { rows: [], error: "Unable to read the file. Upload a CSV or Excel file." };
  }

  if (matrix.length < 2) {
    return { rows: [], error: "The file is empty or has no data rows." };
  }

  // Find the header row (some templates have a title row first).
  const headerRowIndex = matrix.findIndex((row) => {
    const cells = row.map((cell) => normalize(toText(cell)));
    return (
      findColumn(cells, ["staff id", "employee number", "employee no", "staff no", "employee id"]) !== -1 ||
      findColumn(cells, ["beneficiary name", "employee name", "full name", "name"]) !== -1
    ) && findColumn(cells, ["amount", "basic", "net", "salary", "gross"]) !== -1;
  });

  if (headerRowIndex === -1) {
    return {
      rows: [],
      error:
        "Could not find the salary columns. Expected Employee Number/Name plus Amount or Basic Salary.",
    };
  }

  const headers = matrix[headerRowIndex].map((cell) => normalize(toText(cell)));

  const idIndex = findColumn(headers, [
    "staff id",
    "employee number",
    "employee no",
    "staff no",
    "employee id",
  ]);
  const nameIndex = findColumn(headers, [
    "beneficiary name",
    "employee name",
    "full name",
    "name",
  ]);
  const basicIndex = findColumn(headers, ["basic salary", "basic pay", "basic"]);
  const allowancesIndex = findColumn(headers, ["allowance"]);
  const deductionsIndex = findColumn(headers, [
    "other deduction",
    "deductions",
    "deduction",
  ]);
  const netIndex = findColumn(headers, [
    "net pay",
    "net salary",
    "amount",
    "gross salary",
    "gross",
    "salary",
  ]);

  if (basicIndex === -1 && netIndex === -1) {
    return { rows: [], error: "No salary column found (Basic Salary or Amount)." };
  }

  if (idIndex === -1 && nameIndex === -1) {
    return { rows: [], error: "No employee identifier column found." };
  }

  const rows: ParsedSalaryRow[] = [];
  let usedNetAsBasic = false;

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const cells = matrix[index];
    if (!cells || cells.every((cell) => toText(cell) === "")) continue;

    const employeeNumber = idIndex !== -1 ? toText(cells[idIndex]) : "";
    const employeeName = nameIndex !== -1 ? toText(cells[nameIndex]) : "";

    if (!employeeNumber && !employeeName) continue;

    let basicSalary = 0;
    let allowances = 0;
    let otherDeductions = 0;

    if (basicIndex !== -1) {
      basicSalary = toNumber(cells[basicIndex]);
      allowances = allowancesIndex !== -1 ? toNumber(cells[allowancesIndex]) : 0;
      otherDeductions =
        deductionsIndex !== -1 ? toNumber(cells[deductionsIndex]) : 0;
    } else {
      // Bank schedules only carry the net amount - import it as the salary.
      basicSalary = toNumber(cells[netIndex]);
      usedNetAsBasic = true;
    }

    rows.push({
      employeeNumber,
      employeeName,
      basicSalary,
      allowances,
      otherDeductions,
    });
  }

  return {
    rows,
    note: usedNetAsBasic
      ? "Amount column imported as the employee's salary (no allowance/deduction split in this file)."
      : undefined,
  };
}
