import type { StatementData } from "@/services/statement-service";
import { buildWorkbooks, type WorkbookSheet } from "@/lib/workbook-export";

function formatDay(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Build the employee statement as a multi-sheet, print-ready Excel workbook:
 * summary, account activity, thrift interest, thrift funding, repayments and
 * withdrawal receipts.
 */
export function buildStatementWorkbook(statement: StatementData): Buffer {
  const period = `${formatDay(statement.from)} to ${formatDay(statement.to)}`;
  const employee = `${statement.employee.name} (${statement.employee.number})`;
  const subtitle = `${statement.organization.name} · ${statement.employee.name}`;

  const baseMetadata: Array<[string, string]> = [
    ["Period", period],
    ["Employee", employee],
    ["Department", statement.employee.department || "—"],
    ["Organization", statement.organization.name],
  ];

  const summaryRows = [
    { item: "Opening balance", amount: statement.openingBalance },
    { item: "Total credits", amount: statement.totalCredits },
    { item: "Total debits", amount: statement.totalDebits },
    { item: "Closing balance", amount: statement.closingBalance },
    { item: "Thrift opening balance", amount: statement.thrift.openingBalance },
    { item: "Thrift contributions", amount: statement.thrift.contributions },
    { item: "Thrift interest earned", amount: statement.thrift.interestEarned },
    { item: "Thrift closing balance", amount: statement.thrift.closingBalance },
  ];

  const sheets: WorkbookSheet[] = [
    {
      sheetName: "Summary",
      title: "Statement Summary",
      subtitle,
      metadata: [
        ...baseMetadata,
        ["Thrift interest rate", `${statement.thrift.annualRate}% per year`],
        ["Sample data", statement.sample ? "Yes" : "No"],
      ],
      columns: [
        { key: "item", label: "Item" },
        { key: "amount", label: "Amount", format: "currency" },
      ],
      rows: summaryRows,
      autofilter: false,
    },
    {
      sheetName: "Account Activity",
      title: "Account Activity",
      subtitle,
      metadata: baseMetadata,
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "type", label: "Type" },
        { key: "description", label: "Description" },
        { key: "reference", label: "Reference" },
        { key: "debit", label: "Debit", format: "currency" },
        { key: "credit", label: "Credit", format: "currency" },
        { key: "balance", label: "Balance", format: "currency" },
      ],
      rows: statement.lines.map((line) => ({
        date: line.date,
        type: line.type,
        description: line.description,
        reference: line.reference,
        debit: line.debit || 0,
        credit: line.credit || 0,
        balance: line.balance,
      })),
      totals: {
        debit: statement.totalDebits,
        credit: statement.totalCredits,
      },
    },
    {
      sheetName: "Thrift Interest",
      title: "Thrift Savings Interest",
      subtitle,
      metadata: baseMetadata,
      columns: [
        { key: "periodMonth", label: "Month", format: "date" },
        { key: "openingBalance", label: "Opening", format: "currency" },
        { key: "contributions", label: "Contribution", format: "currency" },
        { key: "payouts", label: "Released", format: "currency" },
        { key: "annualRate", label: "Rate %", format: "number" },
        { key: "eligibleDays", label: "Days", format: "number" },
        { key: "interest", label: "Interest", format: "currency" },
        { key: "closingBalance", label: "Closing", format: "currency" },
        { key: "status", label: "Status" },
        { key: "reference", label: "Reference" },
      ],
      rows: statement.thriftInterest.map((record) => ({
        periodMonth: record.periodMonth,
        openingBalance: record.openingBalance,
        contributions: record.contributions,
        payouts: record.payouts,
        annualRate: record.annualRate,
        eligibleDays: record.eligibleDays,
        interest: record.interest,
        closingBalance: record.closingBalance,
        status: record.status,
        reference: record.reference,
      })),
      totals: {
        contributions: statement.thriftInterest.reduce(
          (sum, record) => sum + record.contributions,
          0
        ),
        payouts: statement.thriftInterest.reduce(
          (sum, record) => sum + record.payouts,
          0
        ),
        interest: statement.thriftInterest.reduce(
          (sum, record) => sum + record.interest,
          0
        ),
      },
    },
    {
      sheetName: "Thrift Funding",
      title: "Thrift Funding",
      subtitle,
      metadata: baseMetadata,
      columns: [
        { key: "periodMonth", label: "Funding Month", format: "date" },
        { key: "amount", label: "Funded", format: "currency" },
        { key: "loanRepayment", label: "To Loan", format: "currency" },
        { key: "thriftCredit", label: "To Savings", format: "currency" },
        { key: "status", label: "Status" },
        { key: "reference", label: "Reference" },
      ],
      rows: statement.thriftFundings.map((record) => ({
        periodMonth: record.periodMonth,
        amount: record.amount,
        loanRepayment: record.loanRepayment,
        thriftCredit: record.thriftCredit,
        status: record.status,
        reference: record.reference,
      })),
      totals: {
        amount: statement.thriftFundings.reduce(
          (sum, record) => sum + record.amount,
          0
        ),
        loanRepayment: statement.thriftFundings.reduce(
          (sum, record) => sum + record.loanRepayment,
          0
        ),
        thriftCredit: statement.thriftFundings.reduce(
          (sum, record) => sum + record.thriftCredit,
          0
        ),
      },
    },
    {
      sheetName: "Repayments",
      title: "Loan Repayments",
      subtitle,
      metadata: baseMetadata,
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "productName", label: "Product" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "paymentMethod", label: "Method" },
        { key: "reference", label: "Reference" },
        { key: "notes", label: "Notes" },
      ],
      rows: statement.repayments.map((record) => ({
        date: record.date,
        productName: record.productName,
        amount: record.amount,
        paymentMethod: record.paymentMethod,
        reference: record.reference,
        notes: record.notes ?? "",
      })),
      totals: {
        amount: statement.repayments.reduce(
          (sum, record) => sum + record.amount,
          0
        ),
      },
    },
    {
      sheetName: "Withdrawals",
      title: "Withdrawal Receipts",
      subtitle,
      metadata: baseMetadata,
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "bankName", label: "Bank" },
        { key: "masked", label: "Account" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "status", label: "Status" },
        { key: "reference", label: "Reference" },
      ],
      rows: statement.withdrawals.map((record) => ({
        date: record.date,
        bankName: record.bankName,
        masked: record.masked,
        amount: record.amount,
        status: record.status,
        reference: record.reference,
      })),
      totals: {
        amount: statement.withdrawals.reduce(
          (sum, record) => sum + record.amount,
          0
        ),
      },
    },
  ];

  return buildWorkbooks(sheets);
}

export function statementFileName(statement: StatementData) {
  return `salaryflow-statement-${statement.from}-to-${statement.to}.xlsx`;
}
