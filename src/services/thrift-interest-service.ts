import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";
import { isSampleEmployeeNumber } from "@/lib/demo";
import {
  currentPeriodMonth,
  normalizePeriodMonth,
  periodLabel,
} from "./thrift-service";

/**
 * Monthly interest on employee thrift savings.
 *
 * Interest is calculated on the month's opening savings balance:
 *
 *   opening        = savings balance before the month + contributions credited
 *                    for that month
 *   interest       = opening × annual rate × eligible days ÷ 365
 *   closing        = opening + interest
 *
 * Closed months are posted explicitly (owner/admin) and are idempotent thanks
 * to the unique (employee, month) constraint and the accrual reference.
 */

export const THRIFT_INTEREST_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
]);

const round2 = (value: number) => Math.round(value * 100) / 100;

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);

export interface ThriftInterestAccrual {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  periodMonth: string;
  periodLabel: string;
  openingBalance: number;
  contributions: number;
  annualRate: number;
  eligibleDays: number;
  interest: number;
  closingBalance: number;
  reference: string;
  status: string;
  createdAt: string;
  sample: boolean;
}

export interface ThriftInterestOverview {
  periodMonth: string;
  periodLabel: string;
  closed: boolean;
  annualRate: number;
  accruals: ThriftInterestAccrual[];
  totals: {
    interest: number;
    opening: number;
    contributions: number;
    closing: number;
    posted: number;
    ytdInterest: number;
  };
}

export interface MyThriftInterestSummary {
  employeeNumber: string;
  sample: boolean;
  annualRate: number;
  balance: number;
  ytdInterest: number;
  lifetimeInterest: number;
  currentProjection: number;
  currentMonthLabel: string;
  lastAccrual: ThriftInterestAccrual | null;
  months: ThriftInterestAccrual[];
}

function daysInMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function periodEnd(periodMonth: string) {
  return `${periodMonth.slice(0, 7)}-${String(daysInMonth(periodMonth)).padStart(
    2,
    "0"
  )}`;
}

function isClosedMonth(periodMonth: string) {
  return periodMonth < currentPeriodMonth();
}

function previousMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
}

function monthName(periodMonth: string) {
  return periodLabel(periodMonth);
}

export class ThriftInterestService {
  private constructor(
    private userId: string | null,
    private organizationId: string | null,
    private role: string | null
  ) {}

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let organizationId: string | null = null;
    let role: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      organizationId = profile?.organization_id ?? null;
      role = profile?.role ?? null;
    }

    return new ThriftInterestService(
      user?.id ?? null,
      organizationId,
      role
    );
  }

  private async ensureStaff() {
    if (!this.userId || !this.organizationId) return "Unauthorized";
    if (!this.role || !THRIFT_INTEREST_ROLES.has(this.role)) {
      return "Only the chairman or an admin can post thrift interest";
    }
    return null;
  }

  private ledger() {
    if (!this.organizationId) return null;
    return LedgerService.createForOrganization(
      this.organizationId,
      this.userId
    );
  }

  private async getAnnualRate() {
    if (!this.organizationId) return 5;
    const admin = createAdminClient();
    const { data } = await admin
      .from("organization_settings")
      .select("thrift_interest_rate")
      .eq("organization_id", this.organizationId)
      .maybeSingle();
    const rate = Number(data?.thrift_interest_rate);
    return Number.isFinite(rate) ? rate : 5;
  }

  private async computeAccrual(
    employeeId: string,
    periodMonth: string,
    annualRate: number,
    eligibleDays = daysInMonth(periodMonth)
  ) {
    const ledger = this.ledger();
    if (!ledger) throw new Error("No organization found");

    const admin = createAdminClient();
    const { data: fundings } = await admin
      .from("thrift_fundings")
      .select("thrift_credit")
      .eq("employee_id", employeeId)
      .eq("period_month", periodMonth)
      .eq("status", "POSTED");

    const contributions = round2(
      (fundings ?? []).reduce(
        (sum, funding) => sum + (Number(funding.thrift_credit) || 0),
        0
      )
    );

    // Balance immediately before the month starts, plus this month's
    // contributions. This mirrors the statement breakdown used by the
    // cooperative: opening = prior closing + month's savings contributions.
    const priorBalance = await ledger.getThriftBalanceBefore(
      employeeId,
      periodMonth
    );
    const openingBalance = round2(priorBalance + contributions);
    const interest = round2(
      openingBalance * (annualRate / 100) * (eligibleDays / 365)
    );
    const closingBalance = round2(openingBalance + interest);

    return {
      openingBalance,
      contributions,
      annualRate,
      eligibleDays,
      interest,
      closingBalance,
      reference: `SLF-THINT-${employeeId}-${periodMonth
        .slice(0, 7)
        .replace("-", "")}`,
    };
  }

  private async getEmployee(employeeId: string) {
    if (!this.organizationId) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("employees")
      .select(
        "id, employee_number, first_name, last_name, organization_id"
      )
      .eq("id", employeeId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();
    return data ?? null;
  }

  private async postEmployeeWithRate(
    employeeId: string,
    periodMonth: string,
    annualRate: number
  ): Promise<{
    ok: boolean;
    skipped?: boolean;
    error?: string;
    interest?: number;
    reference?: string;
  }> {
    if (!this.organizationId) return { ok: false, error: "No organization found" };

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("thrift_interest_accruals")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("period_month", periodMonth)
      .maybeSingle();

    if (existing) return { ok: true, skipped: true };

    const calculation = await this.computeAccrual(
      employeeId,
      periodMonth,
      annualRate
    );

    if (calculation.openingBalance <= 0 || calculation.interest <= 0) {
      return { ok: true, skipped: true };
    }

    const { data: accrual, error } = await admin
      .from("thrift_interest_accruals")
      .insert({
        organization_id: this.organizationId,
        employee_id: employeeId,
        period_month: periodMonth,
        opening_balance: calculation.openingBalance,
        contributions: calculation.contributions,
        annual_rate: calculation.annualRate,
        eligible_days: calculation.eligibleDays,
        interest_amount: calculation.interest,
        closing_balance: calculation.closingBalance,
        reference: calculation.reference,
        posted_by: this.userId,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    const ledger = this.ledger();
    if (!ledger) return { ok: false, error: "No organization found" };

    const posted = await ledger.postThriftInterest(
      employeeId,
      calculation.reference,
      calculation.interest,
      periodEnd(periodMonth),
      `Thrift interest for ${monthName(periodMonth)}`
    );

    if (posted.error) {
      await admin
        .from("thrift_interest_accruals")
        .delete()
        .eq("id", accrual.id);
      return { ok: false, error: posted.error };
    }

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "thrift.interest_posted",
      entityType: "thrift_interest_accrual",
      entityId: accrual.id,
      after: {
        employeeId,
        periodMonth,
        openingBalance: calculation.openingBalance,
        contributions: calculation.contributions,
        annualRate: calculation.annualRate,
        eligibleDays: calculation.eligibleDays,
        interest: calculation.interest,
        closingBalance: calculation.closingBalance,
        reference: calculation.reference,
      },
    });

    return {
      ok: true,
      interest: calculation.interest,
      reference: calculation.reference,
    };
  }

  /** Post interest for one employee and one closed month. */
  async postEmployee(employeeId: string, periodMonthInput: string) {
    const forbidden = await this.ensureStaff();
    if (forbidden) return { ok: false as const, error: forbidden };

    const periodMonth = normalizePeriodMonth(periodMonthInput);
    if (!periodMonth) {
      return { ok: false as const, error: "Choose a valid interest month" };
    }
    if (!isClosedMonth(periodMonth)) {
      return {
        ok: false as const,
        error: "Interest can only be posted for a completed month",
      };
    }

    const employee = await this.getEmployee(employeeId);
    if (!employee) {
      return { ok: false as const, error: "Employee not found" };
    }

    const rate = await this.getAnnualRate();
    const result = await this.postEmployeeWithRate(
      employeeId,
      periodMonth,
      rate
    );

    if (!result.ok) return { ok: false as const, error: result.error };
    if (result.skipped) {
      return {
        ok: true as const,
        skipped: true,
        message: `${employee.first_name} already has interest posted for ${monthName(
          periodMonth
        )} or has no savings balance.`,
      };
    }

    return {
      ok: true as const,
      skipped: false,
      interest: result.interest,
      reference: result.reference,
      message: `${naira(result.interest ?? 0)} interest posted to ${
        employee.first_name
      } for ${monthName(periodMonth)}`,
    };
  }

  /** Post interest for every employee with a savings balance for the month. */
  async postMonth(periodMonthInput: string) {
    const forbidden = await this.ensureStaff();
    if (forbidden) return { ok: false as const, error: forbidden };
    if (!this.organizationId) {
      return { ok: false as const, error: "No organization found" };
    }

    const periodMonth = normalizePeriodMonth(periodMonthInput);
    if (!periodMonth) {
      return { ok: false as const, error: "Choose a valid interest month" };
    }
    if (!isClosedMonth(periodMonth)) {
      return {
        ok: false as const,
        error: "Interest can only be posted for a completed month",
      };
    }

    return this.postMonthForOrganization(periodMonth);
  }

  private async postMonthForOrganization(periodMonth: string) {
    if (!this.organizationId) {
      return { ok: false as const, error: "No organization found" };
    }

    const admin = createAdminClient();
    const [rate, employeesResult] = await Promise.all([
      this.getAnnualRate(),
      admin
        .from("employees")
        .select("id")
        .eq("organization_id", this.organizationId),
    ]);
    const eligibleDays = daysInMonth(periodMonth);
    const chunk = <T,>(rows: T[], size = 200) =>
      Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
        rows.slice(index * size, index * size + size)
      );

    const employees = employeesResult.data;

    const employeeIds = (employees ?? []).map((row) => row.id as string);
    if (employeeIds.length === 0) {
      return {
        ok: true as const,
        periodMonth,
        periodLabel: monthName(periodMonth),
        rate,
        posted: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        failures: [] as string[],
      };
    }

    const [existingResult, accountsResult, fundingsResult] = await Promise.all([
      admin
        .from("thrift_interest_accruals")
        .select("employee_id")
        .eq("organization_id", this.organizationId)
        .eq("period_month", periodMonth),
      admin
        .from("financial_accounts")
        .select("id, employee_id")
        .eq("organization_id", this.organizationId)
        .eq("account_type", "THRIFT"),
      admin
        .from("thrift_fundings")
        .select("employee_id, thrift_credit")
        .eq("organization_id", this.organizationId)
        .eq("period_month", periodMonth)
        .eq("status", "POSTED"),
    ]);

    const existing = new Set(
      (existingResult.data ?? []).map((row) => row.employee_id as string)
    );
    const accountByEmployee = new Map<string, string>();
    const employeeByAccount = new Map<string, string>();
    for (const account of accountsResult.data ?? []) {
      accountByEmployee.set(
        account.employee_id as string,
        account.id as string
      );
      employeeByAccount.set(account.id as string, account.employee_id as string);
    }

    const contributions = new Map<string, number>();
    for (const funding of fundingsResult.data ?? []) {
      const employeeId = funding.employee_id as string;
      contributions.set(
        employeeId,
        round2(
          (contributions.get(employeeId) ?? 0) +
            (Number(funding.thrift_credit) || 0)
        )
      );
    }

    const openingByEmployee = new Map<string, number>();
    for (const accountIds of chunk([...employeeByAccount.keys()])) {
      const { data: entries } = await admin
        .from("ledger_entries")
        .select(
          "financial_account_id, debit, credit, ledger_transactions!inner(transaction_date, status)"
        )
        .in("financial_account_id", accountIds)
        .lt("ledger_transactions.transaction_date", periodMonth)
        .neq("ledger_transactions.status", "REVERSED");

      for (const entry of entries ?? []) {
        const employeeId = employeeByAccount.get(
          entry.financial_account_id as string
        );
        if (!employeeId) continue;
        openingByEmployee.set(
          employeeId,
          round2(
            (openingByEmployee.get(employeeId) ?? 0) +
              (Number(entry.credit) || 0) -
              (Number(entry.debit) || 0)
          )
        );
      }
    }

    let skipped = 0;
    const candidates: Array<{
      employeeId: string;
      accountId: string;
      openingBalance: number;
      contributions: number;
      interest: number;
      closingBalance: number;
      reference: string;
    }> = [];

    for (const employeeId of employeeIds) {
      if (existing.has(employeeId)) {
        skipped += 1;
        continue;
      }
      const accountId = accountByEmployee.get(employeeId);
      if (!accountId) {
        skipped += 1;
        continue;
      }
      const openingBalance = round2(
        (openingByEmployee.get(employeeId) ?? 0) +
          (contributions.get(employeeId) ?? 0)
      );
      const interest = round2(
        openingBalance * (rate / 100) * (eligibleDays / 365)
      );
      if (openingBalance <= 0 || interest <= 0) {
        skipped += 1;
        continue;
      }
      candidates.push({
        employeeId,
        accountId,
        openingBalance,
        contributions: contributions.get(employeeId) ?? 0,
        interest,
        closingBalance: round2(openingBalance + interest),
        reference: `SLF-THINT-${employeeId}-${periodMonth
          .slice(0, 7)
          .replace("-", "")}`,
      });
    }

    if (candidates.length === 0) {
      return {
        ok: true as const,
        periodMonth,
        periodLabel: monthName(periodMonth),
        rate,
        posted: 0,
        skipped,
        failed: 0,
        total: 0,
        failures: [] as string[],
      };
    }

    const accrualIds: string[] = [];
    const accrualRows = candidates.map((candidate) => {
      const id = crypto.randomUUID();
      accrualIds.push(id);
      return {
        id,
        organization_id: this.organizationId,
        employee_id: candidate.employeeId,
        period_month: periodMonth,
        opening_balance: candidate.openingBalance,
        contributions: candidate.contributions,
        annual_rate: rate,
        eligible_days: eligibleDays,
        interest_amount: candidate.interest,
        closing_balance: candidate.closingBalance,
        reference: candidate.reference,
        status: "POSTED",
        posted_by: this.userId,
      };
    });

    for (const rows of chunk(accrualRows)) {
      const { error } = await admin.from("thrift_interest_accruals").insert(rows);
      if (error) return { ok: false as const, error: error.message };
    }

    const ledger = this.ledger();
    if (!ledger) {
      await admin.from("thrift_interest_accruals").delete().in("id", accrualIds);
      return { ok: false as const, error: "No organization found" };
    }

    await ledger.ensureChartOfAccounts();
    const expense = await ledger.getAccountByCode("5200");
    if (!expense?.id) {
      await admin.from("thrift_interest_accruals").delete().in("id", accrualIds);
      return {
        ok: false as const,
        error: "Thrift interest expense account is missing",
      };
    }

    const now = new Date().toISOString();
    const transactionDate = periodEnd(periodMonth);
    const transactionRows: Record<string, unknown>[] = [];
    const entryRows: Record<string, unknown>[] = [];

    for (const candidate of candidates) {
      const transactionId = crypto.randomUUID();
      transactionRows.push({
        id: transactionId,
        organization_id: this.organizationId,
        reference: candidate.reference,
        description: `Thrift interest for ${monthName(periodMonth)}`,
        transaction_date: transactionDate,
        transaction_type: "THRIFT_INTEREST",
        status: "POSTED",
        created_by: this.userId,
        created_at: now,
      });
      entryRows.push(
        {
          id: crypto.randomUUID(),
          organization_id: this.organizationId,
          transaction_id: transactionId,
          account_id: expense.id,
          financial_account_id: null,
          description: "Thrift interest - expense",
          debit: candidate.interest,
          credit: 0,
          created_at: now,
        },
        {
          id: crypto.randomUUID(),
          organization_id: this.organizationId,
          transaction_id: transactionId,
          account_id: null,
          financial_account_id: candidate.accountId,
          description: "Thrift interest - employee savings",
          debit: 0,
          credit: candidate.interest,
          created_at: now,
        }
      );
    }

    const referenceList = candidates.map((row) => row.reference);
    const transactionIds = transactionRows.map((row) => row.id as string);
    try {
      for (const rows of chunk(transactionRows)) {
        const { error } = await admin.from("ledger_transactions").insert(rows);
        if (error) throw new Error(error.message);
      }
      for (const rows of chunk(entryRows)) {
        const { error } = await admin.from("ledger_entries").insert(rows);
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      await admin
        .from("ledger_entries")
        .delete()
        .in("transaction_id", transactionIds);
      await admin
        .from("ledger_transactions")
        .delete()
        .in("reference", referenceList);
      await admin.from("thrift_interest_accruals").delete().in("id", accrualIds);
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not post interest",
      };
    }

    const total = round2(
      candidates.reduce((sum, row) => sum + row.interest, 0)
    );

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "thrift.interest_posted_month",
      entityType: "organization",
      entityId: this.organizationId,
      after: {
        periodMonth,
        posted: candidates.length,
        skipped,
        failed: 0,
        total,
        rate,
      },
    });

    return {
      ok: true as const,
      periodMonth,
      periodLabel: monthName(periodMonth),
      rate,
      posted: candidates.length,
      skipped,
      failed: 0,
      total,
      failures: [] as string[],
    };
  }

  /**
   * Cron entry point: post the previous closed month for every organization.
   * Safe to run more than once; existing accruals are skipped.
   */
  static async runForAllOrganizations(periodMonthInput?: string | null) {
    const periodMonth =
      (periodMonthInput ? normalizePeriodMonth(periodMonthInput) : null) ??
      previousMonth();

    if (!isClosedMonth(periodMonth)) {
      return {
        ok: false as const,
        error: "Interest can only be posted for a completed month",
      };
    }

    const admin = createAdminClient();
    const { data: organizations, error } = await admin
      .from("organizations")
      .select("id, name");
    if (error) return { ok: false as const, error: error.message };

    const results: Array<{
      organizationId: string;
      organizationName: string;
      posted: number;
      skipped: number;
      failed: number;
      total: number;
    }> = [];

    for (const organization of organizations ?? []) {
      const service = new ThriftInterestService(
        null,
        organization.id as string,
        null
      );
      const result = await service.postMonthForOrganization(periodMonth);
      if (!result.ok) {
        results.push({
          organizationId: organization.id as string,
          organizationName: (organization.name as string) ?? "Organization",
          posted: 0,
          skipped: 0,
          failed: 1,
          total: 0,
        });
        continue;
      }
      results.push({
        organizationId: organization.id as string,
        organizationName: (organization.name as string) ?? "Organization",
        posted: result.posted,
        skipped: result.skipped,
        failed: result.failed,
        total: result.total,
      });
    }

    return {
      ok: true as const,
      periodMonth,
      periodLabel: monthName(periodMonth),
      organizations: results.length,
      posted: results.reduce((sum, row) => sum + row.posted, 0),
      skipped: results.reduce((sum, row) => sum + row.skipped, 0),
      failed: results.reduce((sum, row) => sum + row.failed, 0),
      total: round2(results.reduce((sum, row) => sum + row.total, 0)),
      results,
    };
  }

  /** Staff view of posted interest for a month plus year-to-date totals. */
  async getOverview(
    periodMonthInput?: string | null
  ): Promise<ThriftInterestOverview | null> {
    if (!this.organizationId) return null;

    const periodMonth =
      (periodMonthInput ? normalizePeriodMonth(periodMonthInput) : null) ??
      previousMonth();
    const admin = createAdminClient();
    const [rate, monthResult, yearResult] = await Promise.all([
      this.getAnnualRate(),
      admin
        .from("thrift_interest_accruals")
        .select(
          `
          id, employee_id, period_month, opening_balance, contributions,
          annual_rate, eligible_days, interest_amount, closing_balance,
          reference, status, created_at,
          employees:employee_id(employee_number, first_name, last_name, department)
        `
        )
        .eq("organization_id", this.organizationId)
        .eq("period_month", periodMonth)
        .order("created_at", { ascending: false }),
      admin
        .from("thrift_interest_accruals")
        .select("interest_amount, period_month")
        .eq("organization_id", this.organizationId)
        .eq("status", "POSTED")
        .gte("period_month", `${periodMonth.slice(0, 4)}-01-01`)
        .lte("period_month", periodMonth),
    ]);

    const mapRow = (row: Record<string, unknown>): ThriftInterestAccrual => {
      const employee = row.employees as unknown as {
        employee_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
      } | null;
      const employeeNumber = employee?.employee_number ?? "";
      return {
        id: row.id as string,
        employeeId: row.employee_id as string,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Employee",
        employeeNumber,
        department: employee?.department ?? "",
        periodMonth: row.period_month as string,
        periodLabel: monthName(row.period_month as string),
        openingBalance: Number(row.opening_balance) || 0,
        contributions: Number(row.contributions) || 0,
        annualRate: Number(row.annual_rate) || 0,
        eligibleDays: Number(row.eligible_days) || 0,
        interest: Number(row.interest_amount) || 0,
        closingBalance: Number(row.closing_balance) || 0,
        reference: (row.reference as string) ?? "",
        status: (row.status as string) ?? "POSTED",
        createdAt: (row.created_at as string) ?? "",
        sample: isSampleEmployeeNumber(employeeNumber),
      };
    };

    const accruals = (monthResult.data ?? []).map(mapRow);
    const ytdInterest = (yearResult.data ?? []).reduce(
      (sum, row) => sum + (Number(row.interest_amount) || 0),
      0
    );

    return {
      periodMonth,
      periodLabel: monthName(periodMonth),
      closed: isClosedMonth(periodMonth),
      annualRate: rate,
      accruals,
      totals: {
        interest: round2(accruals.reduce((sum, row) => sum + row.interest, 0)),
        opening: round2(
          accruals.reduce((sum, row) => sum + row.openingBalance, 0)
        ),
        contributions: round2(
          accruals.reduce((sum, row) => sum + row.contributions, 0)
        ),
        closing: round2(
          accruals.reduce((sum, row) => sum + row.closingBalance, 0)
        ),
        posted: accruals.length,
        ytdInterest: round2(ytdInterest),
      },
    };
  }

  /** Accruals for the statement/report, optionally scoped to a month range. */
  async listAccruals(options?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ThriftInterestAccrual[]> {
    if (!this.organizationId) return [];

    const admin = createAdminClient();
    let query = admin
      .from("thrift_interest_accruals")
      .select(
        `
        id, employee_id, period_month, opening_balance, contributions,
        annual_rate, eligible_days, interest_amount, closing_balance,
        reference, status, created_at,
        employees:employee_id(employee_number, first_name, last_name, department)
      `
      )
      .eq("organization_id", this.organizationId)
      .order("period_month", { ascending: false })
      .limit(options?.limit ?? 500);

    if (options?.employeeId) query = query.eq("employee_id", options.employeeId);
    if (options?.startDate) query = query.gte("period_month", options.startDate);
    if (options?.endDate) query = query.lte("period_month", options.endDate);

    const { data } = await query;

    return (data ?? []).map((row) => {
      const employee = row.employees as unknown as {
        employee_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
      } | null;
      const employeeNumber = employee?.employee_number ?? "";
      return {
        id: row.id as string,
        employeeId: row.employee_id as string,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Employee",
        employeeNumber,
        department: employee?.department ?? "",
        periodMonth: row.period_month as string,
        periodLabel: monthName(row.period_month as string),
        openingBalance: Number(row.opening_balance) || 0,
        contributions: Number(row.contributions) || 0,
        annualRate: Number(row.annual_rate) || 0,
        eligibleDays: Number(row.eligible_days) || 0,
        interest: Number(row.interest_amount) || 0,
        closingBalance: Number(row.closing_balance) || 0,
        reference: (row.reference as string) ?? "",
        status: (row.status as string) ?? "POSTED",
        createdAt: (row.created_at as string) ?? "",
        sample: isSampleEmployeeNumber(employeeNumber),
      };
    });
  }

  private async getMyEmployee() {
    if (!this.userId) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("employees")
      .select("id, organization_id, employee_number")
      .eq("user_id", this.userId)
      .maybeSingle();
    return data ?? null;
  }

  /** Employee dashboard/statement summary. */
  async getMySummary(): Promise<MyThriftInterestSummary | null> {
    const employee = await this.getMyEmployee();
    if (!employee?.id || !employee.organization_id) return null;

    const rate = await this.getAnnualRate();
    const ledger = LedgerService.createForOrganization(employee.organization_id);
    const admin = createAdminClient();

    const [balance, accruals] = await Promise.all([
      ledger.getThriftBalance(employee.id as string),
      admin
        .from("thrift_interest_accruals")
        .select(
          "id, period_month, opening_balance, contributions, annual_rate, eligible_days, interest_amount, closing_balance, reference, status, created_at"
        )
        .eq("employee_id", employee.id)
        .eq("status", "POSTED")
        .order("period_month", { ascending: false }),
    ]);

    const employeeNumber = (employee.employee_number as string) ?? "";
    const months: ThriftInterestAccrual[] = (accruals.data ?? []).map((row) => ({
      id: row.id as string,
      employeeId: employee.id as string,
      employeeName: "",
      employeeNumber,
      department: "",
      periodMonth: row.period_month as string,
      periodLabel: monthName(row.period_month as string),
      openingBalance: Number(row.opening_balance) || 0,
      contributions: Number(row.contributions) || 0,
      annualRate: Number(row.annual_rate) || 0,
      eligibleDays: Number(row.eligible_days) || 0,
      interest: Number(row.interest_amount) || 0,
      closingBalance: Number(row.closing_balance) || 0,
      reference: (row.reference as string) ?? "",
      status: (row.status as string) ?? "POSTED",
      createdAt: (row.created_at as string) ?? "",
      sample: isSampleEmployeeNumber(employeeNumber),
    }));

    const currentMonth = currentPeriodMonth();
    const year = currentMonth.slice(0, 4);
    const lifetimeInterest = round2(
      months.reduce((sum, row) => sum + row.interest, 0)
    );
    const ytdInterest = round2(
      months
        .filter((row) => row.periodMonth.startsWith(year))
        .reduce((sum, row) => sum + row.interest, 0)
    );

    let currentProjection = 0;
    try {
      const projection = await this.computeAccrual(
        employee.id as string,
        currentMonth,
        rate
      );
      currentProjection = projection.interest;
    } catch {
      currentProjection = 0;
    }

    return {
      employeeNumber,
      sample: isSampleEmployeeNumber(employeeNumber),
      annualRate: rate,
      balance,
      ytdInterest,
      lifetimeInterest,
      currentProjection,
      currentMonthLabel: monthName(currentMonth),
      lastAccrual: months[0] ?? null,
      months: months.slice(0, 12),
    };
  }
}
