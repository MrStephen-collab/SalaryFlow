import { NextResponse, type NextRequest } from "next/server";
import { StatementService } from "@/services/statement-service";

export const runtime = "nodejs";

function escapeCsv(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(",");
}

export async function GET(request: NextRequest) {
  const service = await StatementService.create();
  const statement = await service.getStatement(
    request.nextUrl.searchParams.get("from") ?? undefined,
    request.nextUrl.searchParams.get("to") ?? undefined
  );

  if (!statement) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lines: string[] = [
    row(["SalaryFlow Account Statement"]),
    row(["Employee", statement.employee.name]),
    row(["Employee Number", statement.employee.number]),
    row([
      "Department",
      statement.employee.department,
    ]),
    row(["Period", statement.from, statement.to]),
    row(["Opening Balance", statement.openingBalance.toFixed(2)]),
    row(["Total Credits", statement.totalCredits.toFixed(2)]),
    row(["Total Debits", statement.totalDebits.toFixed(2)]),
    row(["Closing Balance", statement.closingBalance.toFixed(2)]),
    "",
    row(["Account Activity"]),
    row(["Date", "Type", "Description", "Reference", "Debit", "Credit", "Balance"]),
    ...statement.lines.map((line) =>
      row([
        line.date,
        line.type,
        line.description,
        line.reference,
        line.debit ? line.debit.toFixed(2) : "",
        line.credit ? line.credit.toFixed(2) : "",
        line.balance.toFixed(2),
      ])
    ),
    "",
    row(["Payroll Summary"]),
    row([
      "Period",
      "Start",
      "End",
      "Gross",
      "Other Deductions",
      "Loan Deductions",
      "Net",
      "Status",
    ]),
    ...statement.payroll.map((record) =>
      row([
        record.periodName,
        record.periodStart ?? "",
        record.periodEnd ?? "",
        record.grossSalary.toFixed(2),
        record.otherDeductions.toFixed(2),
        record.loanDeductions.toFixed(2),
        record.netSalary.toFixed(2),
        record.status,
      ])
    ),
    "",
    row(["Deduction Receipts"]),
    row(["Date", "Period", "Expected", "Deducted", "Shortfall", "Status", "Reference"]),
    ...statement.deductions.map((record) =>
      row([
        record.date,
        record.periodName,
        record.expectedAmount.toFixed(2),
        record.actualAmount.toFixed(2),
        record.shortfall.toFixed(2),
        record.status,
        record.reference,
      ])
    ),
    "",
    row(["Withdrawal Receipts"]),
    row(["Date", "Bank", "Account", "Amount", "Status", "Reference"]),
    ...statement.withdrawals.map((record) =>
      row([
        record.date,
        record.bankName,
        record.masked,
        record.amount.toFixed(2),
        record.status,
        record.reference,
      ])
    ),
  ];

  const csv = `\uFEFF${lines.join("\r\n")}`;
  const fileName = `salaryflow-statement-${statement.from}-to-${statement.to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
