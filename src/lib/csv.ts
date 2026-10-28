export interface CsvRow {
  employeeNumber: string;
  employeeName: string;
  basicSalary: number;
  allowances: number;
  otherDeductions: number;
}

// Simple CSV parser that handles quoted fields
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 0 && row.some((c) => c.trim() !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.length > 0 && row.some((c) => c.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

export function parseSalaryCsv(text: string): CsvRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());

  const colIndex = (name: string) => header.findIndex((h) => h.includes(name));

  const employeeNumberIdx = colIndex("employee") !== -1
    ? header.findIndex((h) => h.includes("number") || h.includes("no"))
    : -1;
  const nameIdx =
    header.findIndex((h) => h.includes("name")) !== -1
      ? header.findIndex((h) => h.includes("name"))
      : -1;
  const basicIdx = header.findIndex((h) => h.includes("basic"));
  const allowancesIdx = header.findIndex((h) => h.includes("allowance"));
  const deductionsIdx = header.findIndex((h) => h.includes("deduction"));

  if (basicIdx === -1 || (employeeNumberIdx === -1 && nameIdx === -1)) {
    return [];
  }

  const result: CsvRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = (idx: number) => (idx !== -1 ? cells[idx]?.trim() ?? "" : "");

    const employeeNumber = get(employeeNumberIdx);
    const employeeName = get(nameIdx);
    const basicSalary = Number(get(basicIdx).replace(/[^0-9.-]/g, "")) || 0;
    const allowances = Number(get(allowancesIdx).replace(/[^0-9.-]/g, "")) || 0;
    const otherDeductions =
      Number(get(deductionsIdx).replace(/[^0-9.-]/g, "")) || 0;

    result.push({
      employeeNumber,
      employeeName,
      basicSalary,
      allowances,
      otherDeductions,
    });
  }

  return result;
}
