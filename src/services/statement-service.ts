import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type Embedded<T> = T | T[] | null;

function unwrap<T>(value: Embedded<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export interface StatementLine {
  id: string;
  date: string;
  description: string;
  reference: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface PayrollLine {
  id: string;
  periodName: string;
  periodStart: string | null;
  periodEnd: string | null;
  grossSalary: number;
  otherDeductions: number;
  loanDeductions: number;
  netSalary: number;
  status: string;
}

export interface DeductionLine {
  id: string;
  periodName: string;
  expectedAmount: number;
  actualAmount: number;
  shortfall: number;
  status: string;
  date: string;
  reference: string;
}

export interface WithdrawalLine {
  id: string;
  amount: number;
  status: string;
  reference: string;
  date: string;
  bankName: string;
  masked: string;
}

export interface StatementData {
  employee: {
    id: string;
    name: string;
    number: string;
    department: string;
    position: string;
  };
  organization: {
    name: string;
    currency: string;
  };
  from: string;
  to: string;
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  payrollTotals: {
    gross: number;
    otherDeductions: number;
    loanDeductions: number;
    net: number;
  };
  lines: StatementLine[];
  payroll: PayrollLine[];
  deductions: DeductionLine[];
  withdrawals: WithdrawalLine[];
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

function dayOf(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function mask(accountNumber: string | null | undefined) {
  if (!accountNumber) return "";
  return `****${accountNumber.slice(-4)}`;
}

export class StatementService {
  private admin: AdminClient;
  private employeeId: string | null;
  private organizationId: string | null;

  private constructor(
    admin: AdminClient,
    employeeId: string | null,
    organizationId: string | null
  ) {
    this.admin = admin;
    this.employeeId = employeeId;
    this.organizationId = organizationId;
  }

  static create = reactCache(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();

    if (!user) return new StatementService(admin, null, null);

    const { data: employee } = await admin
      .from("employees")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return new StatementService(
      admin,
      employee?.id ?? null,
      employee?.organization_id ?? null
    );
  });

  hasAccess() {
    return Boolean(this.employeeId);
  }

  async getStatement(fromInput?: string, toInput?: string) {
    if (!this.employeeId) return null;

    const today = isoDay(new Date());
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const from = validDay(fromInput) ?? yearStart;
    const to = validDay(toInput) ?? today;

    const rangeStart = from <= to ? from : to;
    const rangeEnd = from <= to ? to : from;

    const { data: employee } = await this.admin
      .from("employees")
      .select(
        "id, organization_id, employee_number, first_name, last_name, other_names, department, position"
      )
      .eq("id", this.employeeId)
      .maybeSingle();

    if (!employee) return null;

    const [organizationResult, accountsResult, salaryResult, deductionResult, withdrawalResult] =
      await Promise.all([
        this.admin
          .from("organizations")
          .select("name, currency")
          .eq("id", this.organizationId)
          .maybeSingle(),
        this.admin
          .from("financial_accounts")
          .select("id")
          .eq("employee_id", this.employeeId),
        this.admin
          .from("salary_records")
          .select(
            `
            id,
            gross_salary,
            other_deductions,
            loan_deductions,
            net_salary,
            status,
            created_at,
            salary_periods:salary_period_id(name, start_date, end_date, payment_date)
          `
          )
          .eq("employee_id", this.employeeId)
          .order("created_at", { ascending: false }),
        this.admin
          .from("deduction_records")
          .select(
            `
            id,
            expected_amount,
            actual_amount,
            shortfall,
            status,
            reference,
            processed_at,
            created_at,
            salary_periods:salary_period_id(name)
          `
          )
          .eq("employee_id", this.employeeId)
          .order("created_at", { ascending: false }),
        this.admin
          .from("withdrawal_requests")
          .select(
            `
            id,
            amount,
            net_amount,
            status,
            reference,
            paid_at,
            processed_at,
            created_at,
            bank_accounts(bank_name, account_number)
          `
          )
          .eq("employee_id", this.employeeId)
          .order("created_at", { ascending: false }),
      ]);

    const accountIds = (accountsResult.data ?? []).map((account) => account.id);

    let entries: {
      id: string;
      debit: number | null;
      credit: number | null;
      description: string | null;
      created_at: string;
      ledger_transactions: unknown;
    }[] = [];

    if (accountIds.length > 0) {
      const { data } = await this.admin
        .from("ledger_entries")
        .select(
          `
          id,
          debit,
          credit,
          description,
          created_at,
          ledger_transactions!inner(
            reference,
            description,
            transaction_date,
            transaction_type,
            status
          )
        `
        )
        .in("financial_account_id", accountIds);

      entries = (data ?? []) as typeof entries;
    }

    const movements = entries
      .map((entry) => {
        const transaction = unwrap(
          entry.ledger_transactions as unknown as {
            reference: string | null;
            description: string | null;
            transaction_date: string | null;
            transaction_type: string | null;
            status: string | null;
          }
        );

        return {
          id: entry.id,
          date: dayOf(transaction?.transaction_date) || dayOf(entry.created_at),
          createdAt: entry.created_at,
          description:
            entry.description ?? transaction?.description ?? "Transaction",
          reference: transaction?.reference ?? "",
          type: transaction?.transaction_type ?? "",
          debit: Number(entry.debit) || 0,
          credit: Number(entry.credit) || 0,
        };
      })
      .sort((a, b) => {
        if (a.date === b.date) {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return a.date.localeCompare(b.date);
      });

    let openingBalance = 0;
    let totalCredits = 0;
    let totalDebits = 0;

    for (const movement of movements) {
      if (movement.date < rangeStart) {
        openingBalance += movement.credit - movement.debit;
      } else if (movement.date <= rangeEnd) {
        totalCredits += movement.credit;
        totalDebits += movement.debit;
      }
    }

    let balance = openingBalance;
    const lines: StatementLine[] = [];

    for (const movement of movements) {
      if (movement.date < rangeStart || movement.date > rangeEnd) continue;
      balance += movement.credit - movement.debit;
      lines.push({
        id: movement.id,
        date: movement.date,
        description: movement.description,
        reference: movement.reference,
        type: movement.type,
        debit: movement.debit,
        credit: movement.credit,
        balance,
      });
    }

    const payroll: PayrollLine[] = (salaryResult.data ?? [])
      .map((record) => {
        const period = unwrap(
          record.salary_periods as unknown as Embedded<{
            name: string | null;
            start_date: string | null;
            end_date: string | null;
            payment_date: string | null;
          }>
        );

        return {
          id: record.id,
          periodName: period?.name ?? "Salary period",
          periodStart: period?.start_date ?? null,
          periodEnd: period?.end_date ?? null,
          date:
            dayOf(period?.payment_date) ||
            dayOf(period?.end_date) ||
            dayOf(record.created_at),
          grossSalary: Number(record.gross_salary) || 0,
          otherDeductions: Number(record.other_deductions) || 0,
          loanDeductions: Number(record.loan_deductions) || 0,
          netSalary: Number(record.net_salary) || 0,
          status: record.status,
        };
      })
      .filter((record) => record.date >= rangeStart && record.date <= rangeEnd)
      .map((record) => ({
        id: record.id,
        periodName: record.periodName,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        grossSalary: record.grossSalary,
        otherDeductions: record.otherDeductions,
        loanDeductions: record.loanDeductions,
        netSalary: record.netSalary,
        status: record.status,
      }));

    const deductions: DeductionLine[] = (deductionResult.data ?? [])
      .map((record) => {
        const period = unwrap(
          record.salary_periods as unknown as Embedded<{
            name: string | null;
          }>
        );

        return {
          id: record.id,
          periodName: period?.name ?? "Payroll deduction",
          expectedAmount: Number(record.expected_amount) || 0,
          actualAmount: Number(record.actual_amount) || 0,
          shortfall: Number(record.shortfall) || 0,
          status: record.status,
          date: dayOf(record.processed_at) || dayOf(record.created_at),
          reference: record.reference ?? "",
        };
      })
      .filter((record) => record.date >= rangeStart && record.date <= rangeEnd);

    const withdrawals: WithdrawalLine[] = (withdrawalResult.data ?? [])
      .map((record) => {
        const account = unwrap(
          record.bank_accounts as unknown as Embedded<{
            bank_name: string | null;
            account_number: string | null;
          }>
        );

        return {
          id: record.id,
          amount: Number(record.net_amount) || 0,
          status: record.status,
          reference: record.reference ?? "",
          date:
            dayOf(record.paid_at) ||
            dayOf(record.processed_at) ||
            dayOf(record.created_at),
          bankName: account?.bank_name ?? "",
          masked: mask(account?.account_number),
        };
      })
      .filter((record) => record.date >= rangeStart && record.date <= rangeEnd);

    const payrollTotals = payroll.reduce(
      (totals, record) => {
        totals.gross += record.grossSalary;
        totals.otherDeductions += record.otherDeductions;
        totals.loanDeductions += record.loanDeductions;
        totals.net += record.netSalary;
        return totals;
      },
      { gross: 0, otherDeductions: 0, loanDeductions: 0, net: 0 }
    );

    const employeeName = [
      employee.first_name,
      employee.other_names,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      employee: {
        id: employee.id,
        name: employeeName || "Employee",
        number: employee.employee_number ?? "",
        department: employee.department ?? "",
        position: employee.position ?? "",
      },
      organization: {
        name: organizationResult.data?.name ?? "Organization",
        currency: organizationResult.data?.currency ?? "NGN",
      },
      from: rangeStart,
      to: rangeEnd,
      openingBalance,
      closingBalance: balance,
      totalCredits,
      totalDebits,
      payrollTotals,
      lines,
      payroll,
      deductions,
      withdrawals,
    } satisfies StatementData;
  }
}
