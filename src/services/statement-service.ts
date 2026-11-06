import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSampleEmployeeNumber } from "@/lib/demo";

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

export interface ThriftFundingLine {
  id: string;
  periodMonth: string;
  periodLabel: string;
  amount: number;
  loanRepayment: number;
  thriftCredit: number;
  status: string;
  date: string;
  reference: string;
}

export interface RepaymentLine {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  productName: string;
  notes: string | null;
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

export interface ThriftInterestLine {
  id: string;
  periodMonth: string;
  periodLabel: string;
  openingBalance: number;
  contributions: number;
  payouts: number;
  annualRate: number;
  eligibleDays: number;
  interest: number;
  closingBalance: number;
  reference: string;
  status: string;
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
  thriftTotals: {
    funded: number;
    loanRepayment: number;
    savings: number;
  };
  thrift: {
    openingBalance: number;
    closingBalance: number;
    contributions: number;
    interestEarned: number;
    annualRate: number;
  };
  thriftInterest: ThriftInterestLine[];
  sample: boolean;
  lines: StatementLine[];
  thriftFundings: ThriftFundingLine[];
  repayments: RepaymentLine[];
  withdrawals: WithdrawalLine[];
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
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

    const [organizationResult, accountsResult, thriftResult, repaymentResult, withdrawalResult, interestResult] =
      await Promise.all([
        this.admin
          .from("organizations")
          .select("name, currency")
          .eq("id", this.organizationId)
          .maybeSingle(),
        this.admin
          .from("financial_accounts")
          .select("id, account_type")
          .eq("employee_id", this.employeeId),
        this.admin
          .from("thrift_fundings")
          .select(
            `
            id,
            period_month,
            amount,
            loan_repayment_applied,
            thrift_credit,
            status,
            reference,
            created_at
          `
          )
          .eq("employee_id", this.employeeId)
          .order("period_month", { ascending: false }),
        this.admin
          .from("loan_repayments")
          .select(
            `
            id,
            amount,
            payment_method,
            reference_number,
            notes,
            recorded_at,
            created_at,
            loan_applications!inner(
              employee_id,
              loan_products:loan_product_id(name)
            )
          `
          )
          .eq("loan_applications.employee_id", this.employeeId)
          .order("recorded_at", { ascending: false }),
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
        this.admin
          .from("thrift_interest_accruals")
          .select(
            `
            id,
            period_month,
            opening_balance,
            contributions,
            payouts,
            annual_rate,
            eligible_days,
            interest_amount,
            closing_balance,
            reference,
            status
          `
          )
          .eq("employee_id", this.employeeId)
          .order("period_month", { ascending: false }),
      ]);

    const walletAccountIds = (accountsResult.data ?? [])
      .filter((account) => account.account_type === "AVAILABLE_BALANCE")
      .map((account) => account.id);
    const thriftAccountIds = (accountsResult.data ?? [])
      .filter((account) => account.account_type === "THRIFT")
      .map((account) => account.id);

    let entries: {
      id: string;
      debit: number | null;
      credit: number | null;
      description: string | null;
      created_at: string;
      ledger_transactions: unknown;
    }[] = [];

    if (walletAccountIds.length > 0) {
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
        .in("financial_account_id", walletAccountIds);

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

    // Thrift savings ledger summary: opening/closing balance and the interest
    // credited inside the selected period. These entries live on a separate
    // financial account from the withdrawable wallet.
    let thriftOpeningBalance = 0;
    let thriftClosingBalance = 0;
    let thriftInterestEarned = 0;

    if (thriftAccountIds.length > 0) {
      const { data: thriftEntries } = await this.admin
        .from("ledger_entries")
        .select(
          `
          id,
          debit,
          credit,
          created_at,
          ledger_transactions!inner(transaction_date, transaction_type, status)
        `
        )
        .in("financial_account_id", thriftAccountIds)
        .neq("ledger_transactions.status", "REVERSED");

      const thriftMovements = (thriftEntries ?? [])
        .map((entry) => {
          const transaction = unwrap(
            entry.ledger_transactions as unknown as {
              transaction_date: string | null;
              transaction_type: string | null;
            }
          );
          return {
            date: dayOf(transaction?.transaction_date) || dayOf(entry.created_at),
            debit: Number(entry.debit) || 0,
            credit: Number(entry.credit) || 0,
            type: transaction?.transaction_type ?? "",
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      let runningOpening = 0;
      let runningClosing = 0;
      for (const movement of thriftMovements) {
        const net = movement.credit - movement.debit;
        if (movement.date < rangeStart) {
          runningOpening += net;
        }
        if (movement.date <= rangeEnd) {
          runningClosing += net;
          if (
            movement.date >= rangeStart &&
            movement.type === "THRIFT_INTEREST"
          ) {
            thriftInterestEarned += movement.credit;
          }
        }
      }
      thriftOpeningBalance = runningOpening;
      thriftClosingBalance = runningClosing;
    }

    const thriftFundings: ThriftFundingLine[] = (thriftResult.data ?? [])
      .map((record) => {
        const periodMonth = dayOf(record.period_month);
        const periodLabel = periodMonth
          ? new Date(`${periodMonth}T00:00:00Z`).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })
          : "Thrift funding";

        return {
          id: record.id,
          periodMonth,
          periodLabel,
          amount: Number(record.amount) || 0,
          loanRepayment: Number(record.loan_repayment_applied) || 0,
          thriftCredit: Number(record.thrift_credit) || 0,
          status: record.status,
          date: periodMonth || dayOf(record.created_at),
          reference: record.reference ?? "",
        };
      })
      .filter((record) => record.date >= rangeStart && record.date <= rangeEnd);

    const repayments: RepaymentLine[] = (repaymentResult.data ?? [])
      .map((record) => {
        const loan = unwrap(
          record.loan_applications as unknown as Embedded<{
            loan_products: Embedded<{ name: string | null }>;
          }>
        );
        const product = unwrap(loan?.loan_products);

        return {
          id: record.id,
          date: dayOf(record.recorded_at) || dayOf(record.created_at),
          amount: Number(record.amount) || 0,
          paymentMethod: record.payment_method ?? "",
          reference: record.reference_number ?? "",
          productName: product?.name ?? "Loan",
          notes: record.notes ?? null,
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

    const thriftTotals = thriftFundings.reduce(
      (totals, record) => {
        totals.funded += record.amount;
        totals.loanRepayment += record.loanRepayment;
        totals.savings += record.thriftCredit;
        return totals;
      },
      { funded: 0, loanRepayment: 0, savings: 0 }
    );

    const accrualMonthEnd = (periodMonth: string) => {
      const [year, month] = periodMonth.split("-").map(Number);
      const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return `${periodMonth.slice(0, 7)}-${String(day).padStart(2, "0")}`;
    };

    const thriftInterest: ThriftInterestLine[] = (interestResult.data ?? [])
      .map((record) => {
        const periodMonth = dayOf(record.period_month);
        const periodLabel = periodMonth
          ? new Date(`${periodMonth}T00:00:00Z`).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })
          : "Interest";
        return {
          id: record.id,
          periodMonth,
          periodLabel,
          openingBalance: Number(record.opening_balance) || 0,
          contributions: Number(record.contributions) || 0,
          payouts: Number(record.payouts) || 0,
          annualRate: Number(record.annual_rate) || 0,
          eligibleDays: Number(record.eligible_days) || 0,
          interest: Number(record.interest_amount) || 0,
          closingBalance: Number(record.closing_balance) || 0,
          reference: record.reference ?? "",
          status: record.status ?? "POSTED",
        };
      })
      .filter(
        (record) =>
          record.periodMonth <= rangeEnd &&
          accrualMonthEnd(record.periodMonth) >= rangeStart
      );

    const thriftAnnualRate =
      thriftInterest[0]?.annualRate ?? 5;

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
      thriftTotals,
      thrift: {
        openingBalance: round2(thriftOpeningBalance),
        closingBalance: round2(thriftClosingBalance),
        contributions: round2(thriftTotals.savings),
        interestEarned: round2(thriftInterestEarned),
        annualRate: thriftAnnualRate,
      },
      thriftInterest,
      sample: isSampleEmployeeNumber(employee.employee_number),
      lines,
      thriftFundings,
      repayments,
      withdrawals,
    } satisfies StatementData;
  }
}
