import { buildWorkbook } from "@/lib/workbook-export";

/**
 * Loan repayment schedule exports.
 *
 * The schedule is shared by employees, members and staff, so the same data is
 * rendered to Excel (.xlsx), Word (.doc) and a small hand-built PDF. Keeping
 * the PDF generator here avoids pulling a heavy PDF dependency into the app.
 */

export interface LoanScheduleExportRow {
  month: number;
  dueDate: string | null;
  opening: number;
  principal: number;
  interest: number;
  total: number;
  paid: number;
  status: string;
}

export interface LoanScheduleExportData {
  borrowerName: string;
  borrowerNumber: string;
  productName: string;
  amount: number;
  totalInterest: number;
  totalRepayment: number;
  monthly: number;
  interestRate: number;
  interestMethod: string;
  durationMonths: number;
  status: string;
  disbursedAt: string | null;
  generatedAt: string;
  schedule: LoanScheduleExportRow[];
}

function amount(value: number) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(value: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

const columns = [
  "#",
  "Due date",
  "Opening",
  "Principal",
  "Interest",
  "Total",
  "Paid",
  "Status",
] as const;

function summaryRows(data: LoanScheduleExportData) {
  return [
    ["Borrower", data.borrowerName],
    ["Borrower number", data.borrowerNumber || "—"],
    ["Product", data.productName],
    ["Loan amount", `NGN ${amount(data.amount)}`],
    ["Interest", `${data.interestRate}% ${data.interestMethod}`],
    ["Duration", `${data.durationMonths} months`],
    ["Monthly instalment", `NGN ${amount(data.monthly)}`],
    ["Total interest", `NGN ${amount(data.totalInterest)}`],
    ["Total repayment", `NGN ${amount(data.totalRepayment)}`],
    ["Status", statusLabel(data.status)],
    ["Disbursed", date(data.disbursedAt)],
    ["Generated", date(data.generatedAt)],
  ];
}

function tableHtml(data: LoanScheduleExportData, excel = false) {
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = data.schedule
    .map(
      (row) => `<tr>
<td>${row.month}</td>
<td>${escapeHtml(date(row.dueDate))}</td>
<td${excel ? ' class="money"' : ""}>${amount(row.opening)}</td>
<td${excel ? ' class="money"' : ""}>${amount(row.principal)}</td>
<td${excel ? ' class="money"' : ""}>${amount(row.interest)}</td>
<td${excel ? ' class="money"' : ""}>${amount(row.total)}</td>
<td${excel ? ' class="money"' : ""}>${amount(row.paid)}</td>
<td>${escapeHtml(statusLabel(row.status))}</td>
</tr>`
    )
    .join("");

  const totals = data.schedule.reduce(
    (sum, row) => ({
      opening: row.month === 1 ? row.opening : sum.opening,
      principal: sum.principal + row.principal,
      interest: sum.interest + row.interest,
      total: sum.total + row.total,
      paid: sum.paid + row.paid,
    }),
    { opening: 0, principal: 0, interest: 0, total: 0, paid: 0 }
  );

  const totalRow = `<tr>
<td colspan="2"><strong>Total</strong></td>
<td${excel ? ' class="money"' : ""}><strong>${amount(totals.opening)}</strong></td>
<td${excel ? ' class="money"' : ""}><strong>${amount(totals.principal)}</strong></td>
<td${excel ? ' class="money"' : ""}><strong>${amount(totals.interest)}</strong></td>
<td${excel ? ' class="money"' : ""}><strong>${amount(totals.total)}</strong></td>
<td${excel ? ' class="money"' : ""}><strong>${amount(totals.paid)}</strong></td>
<td></td>
</tr>`;

  return `<table>
<thead><tr>${head}</tr></thead>
<tbody>${body}${totalRow}</tbody>
</table>`;
}

function summaryHtml(data: LoanScheduleExportData) {
  return `<table class="summary">
${summaryRows(data)
  .map(
    ([label, value]) =>
      `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
  )
  .join("")}
</table>`;
}

export function buildLoanScheduleHtml(
  data: LoanScheduleExportData,
  mode: "excel" | "doc" | "print"
) {
  const printStyles =
    mode === "print"
      ? `<style>
        @page { size: A4 landscape; margin: 12mm; }
        @media print { .no-print { display: none; } body { margin: 0; } }
        body { font-family: Arial, sans-serif; color: #111; }
        table { border-collapse: collapse; width: 100%; margin-top: 12px; }
        th, td { border: 1px solid #999; padding: 5px 7px; font-size: 11px; }
        th { background: #e5e7eb; text-align: left; }
        td:nth-child(n + 3), th:nth-child(n + 3) { text-align: right; }
        .summary { width: auto; margin-bottom: 8px; }
        .summary td { border: 0; padding: 2px 12px 2px 0; font-size: 12px; }
        .summary .label { color: #555; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: #555; font-size: 12px; }
      </style>
      <script>window.addEventListener("load", function () { window.print(); });</script>`
      : `<style>
        body { font-family: Calibri, Arial, sans-serif; color: #111; }
        h1 { font-size: 20px; }
        table { border-collapse: collapse; }
        th, td { border: 1px solid #9ca3af; padding: 4px 8px; }
        th { background: #d1d5db; }
        .summary td { border: 0; padding: 2px 8px 2px 0; }
        .label { color: #555; }
        .money { mso-number-format:'\\#,##0.00'; }
      </style>`;

  const excelNamespace =
    mode === "excel"
      ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"'
      : "";

  return `<!DOCTYPE html>
<html${excelNamespace}>
<head>
<meta charset="utf-8" />
<title>Loan Repayment Schedule</title>
${printStyles}
</head>
<body>
${mode === "print" ? '<p class="no-print muted">Use Print → Save as PDF to keep a copy.</p>' : ""}
<h1>SalaryFlow Loan Repayment Schedule</h1>
<p class="muted">${escapeHtml(data.borrowerName)} · ${escapeHtml(
    data.productName
  )} · Generated ${escapeHtml(date(data.generatedAt))}</p>
${summaryHtml(data)}
${tableHtml(data, mode === "excel")}
</body>
</html>`;
}

export function buildLoanScheduleWorkbook(
  data: LoanScheduleExportData
): Buffer {
  const totals = data.schedule.reduce(
    (sum, row) => ({
      principal: sum.principal + row.principal,
      interest: sum.interest + row.interest,
      total: sum.total + row.total,
      paid: sum.paid + row.paid,
    }),
    { principal: 0, interest: 0, total: 0, paid: 0 }
  );

  return buildWorkbook({
    sheetName: "Repayment Schedule",
    title: "SalaryFlow Loan Repayment Schedule",
    subtitle: `${data.borrowerName} · ${data.productName}`,
    metadata: [
      ["Borrower", data.borrowerName],
      ["Borrower number", data.borrowerNumber || "—"],
      ["Product", data.productName],
      ["Loan amount (NGN)", amount(data.amount)],
      ["Interest", `${data.interestRate}% ${data.interestMethod}`],
      ["Duration", `${data.durationMonths} months`],
      ["Monthly instalment (NGN)", amount(data.monthly)],
      ["Total interest (NGN)", amount(data.totalInterest)],
      ["Total repayment (NGN)", amount(data.totalRepayment)],
      ["Status", statusLabel(data.status)],
      ["Disbursed", date(data.disbursedAt)],
    ],
    columns: [
      { key: "month", label: "#" },
      { key: "dueDate", label: "Due date", format: "date" },
      { key: "opening", label: "Opening (NGN)", format: "currency" },
      { key: "principal", label: "Principal (NGN)", format: "currency" },
      { key: "interest", label: "Interest (NGN)", format: "currency" },
      { key: "total", label: "Total (NGN)", format: "currency" },
      { key: "paid", label: "Paid (NGN)", format: "currency" },
      { key: "status", label: "Status" },
    ],
    rows: data.schedule.map((row) => ({
      ...row,
      dueDate: row.dueDate,
    })),
    totals,
    generatedAt: data.generatedAt,
  });
}

function fixed(value: string, width: number, align: "left" | "right" = "left") {
  const text = value.length > width ? value.slice(0, width) : value;
  return align === "right" ? text.padStart(width) : text.padEnd(width);
}

function scheduleLine(row: LoanScheduleExportRow) {
  return [
    fixed(String(row.month), 4, "right"),
    fixed(date(row.dueDate), 12),
    fixed(amount(row.opening), 18, "right"),
    fixed(amount(row.principal), 18, "right"),
    fixed(amount(row.interest), 18, "right"),
    fixed(amount(row.total), 18, "right"),
    fixed(amount(row.paid), 18, "right"),
    fixed(statusLabel(row.status), 22),
  ].join(" ");
}

const scheduleHeader = [
  fixed("#", 4, "right"),
  fixed("Due date", 12),
  fixed("Opening", 18, "right"),
  fixed("Principal", 18, "right"),
  fixed("Interest", 18, "right"),
  fixed("Total", 18, "right"),
  fixed("Paid", 18, "right"),
  fixed("Status", 22),
].join(" ");

export function buildLoanSchedulePdf(data: LoanScheduleExportData): Buffer {
  const pageHeight = 595;
  const startY = pageHeight - 36;
  const lineHeight = 12;
  const bottomMargin = 36;
  const maxLinesPerPage =
    Math.floor((startY - bottomMargin) / lineHeight) + 1;

  const summary: string[] = [
    "SalaryFlow Loan Repayment Schedule",
    "",
    ...summaryRows(data).map(([label, value]) => `${label.padEnd(20)} ${value}`),
  ];

  const rows = data.schedule.map(scheduleLine);
  const firstPageLines = summary.length + 2;
  const firstPageRowCount = Math.max(1, maxLinesPerPage - firstPageLines);
  const continuedHeader = [
    "SalaryFlow Loan Repayment Schedule (continued)",
    "",
    scheduleHeader,
  ];
  const otherPageRowCount = Math.max(
    1,
    maxLinesPerPage - continuedHeader.length
  );

  const pages: string[][] = [];
  pages.push([
    ...summary,
    "",
    scheduleHeader,
    ...rows.slice(0, firstPageRowCount),
  ]);

  for (
    let index = firstPageRowCount;
    index < rows.length;
    index += otherPageRowCount
  ) {
    pages.push([
      ...continuedHeader,
      ...rows.slice(index, index + otherPageRowCount),
    ]);
  }

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${4 + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  pages.forEach((pageLines, index) => {
    const content = [
      "BT",
      "/F1 9 Tf",
      `36 ${startY} Td`,
      `${lineHeight} TL`,
      ...pageLines.map((line) => `(${pdfEscape(line)}) Tj T*`),
      "ET",
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${
        5 + index * 2
      } 0 R >>`
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function loanScheduleFileName(
  data: LoanScheduleExportData,
  extension: string
) {
  const slug = `${data.borrowerName}-${data.productName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `salaryflow-loan-schedule-${slug}-${new Date()
    .toISOString()
    .slice(0, 10)}.${extension}`;
}
