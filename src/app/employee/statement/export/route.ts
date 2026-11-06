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
    row(["Sample Data", statement.sample ? "Yes" : "No"]),
    row(["Thrift Opening Balance", statement.thrift.openingBalance.toFixed(2)]),
    row(["Thrift Contributions", statement.thrift.contributions.toFixed(2)]),
    row(["Thrift Interest Earned", statement.thrift.interestEarned.toFixed(2)]),
    row(["Thrift Closing Balance", statement.thrift.closingBalance.toFixed(2)]),
    row(["Thrift Interest Rate", `${statement.thrift.annualRate}%`]),
    "",
    row(["Thrift Savings Interest"]),
    row([
      "Month",
      "Opening",
      "Contribution",
      "Released",
      "Rate",
      "Days",
      "Interest",
      "Closing",
      "Status",
    ]),
    ...statement.thriftInterest.map((record) =>
      row([
        record.periodLabel,
        record.openingBalance.toFixed(2),
        record.contributions.toFixed(2),
        record.payouts.toFixed(2),
        `${record.annualRate}%`,
        record.eligibleDays,
        record.interest.toFixed(2),
        record.closingBalance.toFixed(2),
        record.status,
      ])
    ),
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
    row(["Thrift Funding Summary"]),
    row(["Month", "Funded", "To Loan", "To Savings", "Status", "Reference"]),
    ...statement.thriftFundings.map((record) =>
      row([
        record.periodLabel,
        record.amount.toFixed(2),
        record.loanRepayment.toFixed(2),
        record.thriftCredit.toFixed(2),
        record.status,
        record.reference,
      ])
    ),
    "",
    row(["Loan Repayments"]),
    row(["Date", "Product", "Amount", "Method", "Reference", "Notes"]),
    ...statement.repayments.map((record) =>
      row([
        record.date,
        record.productName,
        record.amount.toFixed(2),
        record.paymentMethod,
        record.reference,
        record.notes ?? "",
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
