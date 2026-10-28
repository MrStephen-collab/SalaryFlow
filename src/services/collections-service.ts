import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * Delinquency and failed deduction handling (spec #51 and #54).
 *
 * Loans become delinquent when a scheduled installment passes its due date
 * without full payment. A sweep promotes schedules to LATE, flags loans that
 * are 90+ days overdue as DEFAULTED, and surfaces everything on a collections
 * dashboard. Shortfalls are never silently written off: they can be recovered
 * (partially or fully) or waived with an explicit reason.
 */

export type RiskBucket = "1-30" | "31-60" | "61-90" | "90+";

export const COLLECTIONS_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "LOAN_OFFICER",
  "ACCOUNTANT",
  "PAYROLL_OFFICER",
  "AUDITOR",
]);

const COLLECTIONS_MANAGER_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "LOAN_OFFICER",
]);

/** Days past due before a loan is classified as defaulted. */
export const DEFAULT_THRESHOLD_DAYS = 90;

export interface DelinquentLoan {
  loanApplicationId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  email: string;
  phone: string;
  loanStatus: string;
  loanAmount: number;
  monthlyDeduction: number;
  overdueInstallments: number;
  daysPastDue: number;
  firstDueDate: string | null;
  overdueAmount: number;
  totalOutstanding: number;
  riskBucket: RiskBucket;
  isDefaulted: boolean;
}

export interface DeductionException {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  email: string;
  phone: string;
  periodName: string;
  reference: string;
  status: string;
  expectedAmount: number;
  actualAmount: number;
  shortfall: number;
  remainingBalance: number;
  processedAt: string | null;
  loanApplicationId: string | null;
  scheduleId: string | null;
  notes: string | null;
}

export interface CollectionsSummary {
  delinquentLoans: number;
  defaultedLoans: number;
  totalOverdue: number;
  totalOutstanding: number;
  averageDaysPastDue: number;
  buckets: Record<RiskBucket, { count: number; amount: number }>;
  deductionExceptions: number;
  shortfallAmount: number;
}

export interface SweepResult {
  success?: string;
  error?: string;
  markedDue?: number;
  markedLate?: number;
  defaultedLoans?: number;
}

type ScheduleRow = {
  id: string;
  loan_application_id: string;
  month_number: number;
  due_date: string | null;
  status: string;
  total_payment: number;
  paid_amount: number;
};

type EmployeeEmbed = {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  department: string | null;
  email: string;
  phone: string;
};

type ApplicationRow = {
  id: string;
  employee_id: string;
  amount: number;
  monthly_deduction: number;
  status: string;
  employees: EmployeeEmbed | EmployeeEmbed[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function dateOnly(value: string | null) {
  if (!value) return null;
  return value.slice(0, 10);
}

/** Whole days between a due date and today, using calendar dates (UTC). */
function daysBetween(dueDate: string, today = todayString()) {
  const due = Date.parse(`${dateOnly(dueDate)}T00:00:00.000Z`);
  const now = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return 0;
  return Math.floor((now - due) / (24 * 60 * 60 * 1000));
}

export function riskBucketFor(daysPastDue: number): RiskBucket {
  if (daysPastDue > 90) return "90+";
  if (daysPastDue > 60) return "61-90";
  if (daysPastDue > 30) return "31-60";
  return "1-30";
}

function outstandingFor(schedule: { total_payment: number; paid_amount: number }) {
  return Math.max(
    0,
    Math.round((Number(schedule.total_payment) - Number(schedule.paid_amount)) * 100) / 100
  );
}

export class CollectionsService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;
  private userId: string | null = null;
  private role: string | null = null;

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let orgId: string | null = null;
    let role: string | null = null;

    if (user) {
      // user_profiles can be RLS-shadowed from its own row, so resolve the
      // role and organization with the service-role client (same approach as
      // AuditService and auth.ts).
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        orgId = profile.organization_id ?? null;
        role = profile.role ?? null;
      } else {
        const { data: employee } = await admin
          .from("employees")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();
        orgId = employee?.organization_id ?? null;
      }
    }

    const service = new CollectionsService(supabase);
    service.orgId = orgId;
    service.userId = user?.id ?? null;
    service.role = role;
    return service;
  }

  getRole() {
    return this.role;
  }

  canViewCollections() {
    return Boolean(this.orgId && this.role && COLLECTIONS_ROLES.has(this.role));
  }

  canManageCollections() {
    return Boolean(
      this.orgId && this.role && COLLECTIONS_MANAGER_ROLES.has(this.role)
    );
  }

  private audit(
    action: string,
    entityType: string,
    entityId: string | null,
    before: Record<string, unknown> | null = null,
    after: Record<string, unknown> | null = null
  ) {
    return recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action,
      entityType,
      entityId,
      before,
      after,
    });
  }

  /**
   * Promote schedules into DUE / LATE and flag loans that are 90+ days past
   * due as DEFAULTED. Safe to run repeatedly (idempotent).
   */
  async sweepOverdue(): Promise<SweepResult> {
    if (!this.canManageCollections()) return { error: "Unauthorized" };

    const today = todayString();
    let markedDue = 0;
    let markedLate = 0;

    const { data: dueNow } = await this.supabase
      .from("loan_schedules")
      .select("id, loan_applications!inner(organization_id, status)")
      .eq("loan_applications.organization_id", this.orgId!)
      .in("loan_applications.status", ["ACTIVE"])
      .eq("status", "UPCOMING")
      .lte("due_date", today);

    if (dueNow && dueNow.length > 0) {
      const ids = dueNow.map((row) => row.id);
      const { error } = await this.supabase
        .from("loan_schedules")
        .update({ status: "DUE" })
        .in("id", ids);
      if (!error) markedDue = ids.length;
    }

    const { data: pastDue } = await this.supabase
      .from("loan_schedules")
      .select("id, loan_applications!inner(organization_id, status)")
      .eq("loan_applications.organization_id", this.orgId!)
      .in("loan_applications.status", ["ACTIVE"])
      .in("status", ["DUE", "UPCOMING"])
      .lt("due_date", today);

    if (pastDue && pastDue.length > 0) {
      const ids = pastDue.map((row) => row.id);
      const { error } = await this.supabase
        .from("loan_schedules")
        .update({ status: "LATE" })
        .in("id", ids);
      if (!error) markedLate = ids.length;
    }

    // Flag loans that have crossed the default threshold.
    const defaultedLoans = await this.applyDefaultThreshold(90);

    if (markedDue > 0 || markedLate > 0 || defaultedLoans > 0) {
      await this.audit(
        "collections.overdue_swept",
        "loan_schedule",
        null,
        null,
        { markedDue, markedLate, defaultedLoans, thresholdDays: DEFAULT_THRESHOLD_DAYS }
      );
    }

    const parts: string[] = [];
    if (markedDue > 0) parts.push(`${markedDue} marked due`);
    if (markedLate > 0) parts.push(`${markedLate} marked late`);
    if (defaultedLoans > 0) parts.push(`${defaultedLoans} loan(s) defaulted`);

    return {
      success:
        parts.length > 0
          ? `Overdue refresh complete: ${parts.join(", ")}.`
          : "All schedules are up to date.",
      markedDue,
      markedLate,
      defaultedLoans,
    };
  }

  private async applyDefaultThreshold(thresholdDays: number) {
    if (!this.orgId) return 0;

    const today = todayString();
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: overdue } = await this.supabase
      .from("loan_schedules")
      .select(
        "id, loan_application_id, due_date, status, total_payment, paid_amount, loan_applications!inner(organization_id)"
      )
      .eq("loan_applications.organization_id", this.orgId)
      .eq("status", "LATE")
      .lte("due_date", cutoff)
      .order("due_date", { ascending: true });

    if (!overdue || overdue.length === 0) return 0;

    const loanIds = Array.from(
      new Set(overdue.map((row) => row.loan_application_id))
    );

    const { data: loans } = await this.supabase
      .from("loan_applications")
      .select("id, status")
      .eq("organization_id", this.orgId)
      .in("id", loanIds)
      .in("status", ["ACTIVE"]);

    const activeLoanIds = new Set((loans ?? []).map((loan) => loan.id));
    let defaulted = 0;

    for (const loanId of loanIds) {
      if (!activeLoanIds.has(loanId)) continue;

      const earliest = overdue
        .filter((row) => row.loan_application_id === loanId)
        .map((row) => dateOnly(row.due_date))
        .filter((value): value is string => Boolean(value))
        .sort()[0];

      if (!earliest || daysBetween(earliest, today) < thresholdDays) continue;

      const { error } = await this.supabase
        .from("loan_applications")
        .update({ status: "DEFAULTED" })
        .eq("id", loanId)
        .eq("organization_id", this.orgId);

      if (error) continue;

      defaulted += 1;
      await this.audit(
        "collections.loan_defaulted",
        "loan_application",
        loanId,
        { status: "ACTIVE" },
        { status: "DEFAULTED", daysPastDue: daysBetween(earliest, today) }
      );
    }

    return defaulted;
  }

  /** Overdue loans with days past due, outstanding amounts and contacts. */
  async listDelinquentLoans(): Promise<DelinquentLoan[]> {
    if (!this.canViewCollections()) return [];

    const { data: applications } = await this.supabase
      .from("loan_applications")
      .select(
        `
        id, employee_id, amount, monthly_deduction, status,
        employees:employee_id(
          id, employee_number, first_name, last_name, department, email, phone
        )
      `
      )
      .eq("organization_id", this.orgId!)
      .in("status", ["ACTIVE", "DEFAULTED", "RESTRUCTURED"]);

    if (!applications || applications.length === 0) return [];

    const applicationIds = applications.map((row) => row.id);

    const { data: schedules } = await this.supabase
      .from("loan_schedules")
      .select(
        "id, loan_application_id, month_number, due_date, status, total_payment, paid_amount"
      )
      .in("loan_application_id", applicationIds)
      .in("status", ["UPCOMING", "DUE", "LATE"]);

    const schedulesByLoan = new Map<string, ScheduleRow[]>();
    for (const schedule of (schedules ?? []) as ScheduleRow[]) {
      const list = schedulesByLoan.get(schedule.loan_application_id) ?? [];
      list.push(schedule);
      schedulesByLoan.set(schedule.loan_application_id, list);
    }

    const today = todayString();
    const rows: DelinquentLoan[] = [];

    for (const application of applications as unknown as ApplicationRow[]) {
      const employee = unwrap(application.employees);
      const loanSchedules = schedulesByLoan.get(application.id) ?? [];

      const overdue = loanSchedules
        .filter((schedule) => {
          const due = dateOnly(schedule.due_date);
          return Boolean(due && due < today);
        })
        .sort((a, b) => (dateOnly(a.due_date) ?? "").localeCompare(dateOnly(b.due_date) ?? ""));

      if (overdue.length === 0) continue;

      const firstDueDate = dateOnly(overdue[0].due_date);
      const daysPastDue = firstDueDate ? Math.max(0, daysBetween(firstDueDate, today)) : 0;

      rows.push({
        loanApplicationId: application.id,
        employeeId: application.employee_id,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`.trim()
          : "Unknown",
        employeeNumber: employee?.employee_number ?? "",
        department: employee?.department ?? "—",
        email: employee?.email ?? "",
        phone: employee?.phone ?? "",
        loanStatus: application.status,
        loanAmount: Number(application.amount) || 0,
        monthlyDeduction: Number(application.monthly_deduction) || 0,
        overdueInstallments: overdue.length,
        daysPastDue,
        firstDueDate,
        overdueAmount:
          Math.round(
            overdue.reduce((sum, schedule) => sum + outstandingFor(schedule), 0) * 100
          ) / 100,
        totalOutstanding:
          Math.round(
            loanSchedules.reduce((sum, schedule) => sum + outstandingFor(schedule), 0) * 100
          ) / 100,
        riskBucket: riskBucketFor(daysPastDue),
        isDefaulted: application.status === "DEFAULTED",
      });
    }

    return rows.sort((a, b) => b.daysPastDue - a.daysPastDue);
  }

  /** Partial or failed deductions that still carry an unresolved shortfall. */
  async listDeductionExceptions(): Promise<DeductionException[]> {
    if (!this.canViewCollections()) return [];

    const { data } = await this.supabase
      .from("deduction_records")
      .select(
        `
        id, employee_id, status, expected_amount, actual_amount, shortfall,
        remaining_balance, processed_at, loan_application_id, schedule_id,
        notes, reference,
        employees:employee_id(
          employee_number, first_name, last_name, department, email, phone
        ),
        salary_periods:salary_period_id(name)
      `
      )
      .eq("organization_id", this.orgId!)
      .in("status", ["PARTIAL", "FAILED"])
      .gt("shortfall", 0)
      .order("processed_at", { ascending: false })
      .limit(200);

    return (data ?? []).map((row) => {
      const employee = unwrap(
        row.employees as unknown as EmployeeEmbed | EmployeeEmbed[] | null
      );
      const period = unwrap(
        row.salary_periods as unknown as { name: string } | { name: string }[] | null
      );

      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`.trim()
          : "Unknown",
        employeeNumber: employee?.employee_number ?? "",
        department: employee?.department ?? "—",
        email: employee?.email ?? "",
        phone: employee?.phone ?? "",
        periodName: period?.name ?? "—",
        reference: row.reference,
        status: row.status,
        expectedAmount: Number(row.expected_amount) || 0,
        actualAmount: Number(row.actual_amount) || 0,
        shortfall: Number(row.shortfall) || 0,
        remainingBalance: Number(row.remaining_balance) || 0,
        processedAt: row.processed_at,
        loanApplicationId: row.loan_application_id,
        scheduleId: row.schedule_id,
        notes: row.notes,
      };
    });
  }

  async getSummary(): Promise<CollectionsSummary> {
    const emptyBuckets: Record<RiskBucket, { count: number; amount: number }> = {
      "1-30": { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "61-90": { count: 0, amount: 0 },
      "90+": { count: 0, amount: 0 },
    };

    if (!this.canViewCollections()) {
      return {
        delinquentLoans: 0,
        defaultedLoans: 0,
        totalOverdue: 0,
        totalOutstanding: 0,
        averageDaysPastDue: 0,
        buckets: emptyBuckets,
        deductionExceptions: 0,
        shortfallAmount: 0,
      };
    }

    const [loans, exceptions] = await Promise.all([
      this.listDelinquentLoans(),
      this.listDeductionExceptions(),
    ]);

    const buckets = { ...emptyBuckets };
    for (const bucket of Object.keys(buckets) as RiskBucket[]) {
      buckets[bucket] = { count: 0, amount: 0 };
    }

    let totalOverdue = 0;
    let totalOutstanding = 0;
    let daysSum = 0;

    for (const loan of loans) {
      buckets[loan.riskBucket].count += 1;
      buckets[loan.riskBucket].amount += loan.overdueAmount;
      totalOverdue += loan.overdueAmount;
      totalOutstanding += loan.totalOutstanding;
      daysSum += loan.daysPastDue;
    }

    const round = (value: number) => Math.round(value * 100) / 100;

    return {
      delinquentLoans: loans.length,
      defaultedLoans: loans.filter((loan) => loan.isDefaulted).length,
      totalOverdue: round(totalOverdue),
      totalOutstanding: round(totalOutstanding),
      averageDaysPastDue: loans.length ? Math.round(daysSum / loans.length) : 0,
      buckets,
      deductionExceptions: exceptions.length,
      shortfallAmount: round(
        exceptions.reduce((sum, exception) => sum + exception.shortfall, 0)
      ),
    };
  }

  /**
   * Recover part or all of a deduction shortfall. The instalment is credited,
   * the deduction record updated, and the amount posted to the ledger and the
   * active fund account so financial records stay consistent.
   */
  async recoverShortfall(deductionRecordId: string, amount: number, note?: string) {
    if (!this.canManageCollections() || !this.userId) return { error: "Unauthorized" };
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Recovery amount must be greater than 0" };
    }

    const { data: record } = await this.supabase
      .from("deduction_records")
      .select("*")
      .eq("id", deductionRecordId)
      .eq("organization_id", this.orgId!)
      .single();

    if (!record) return { error: "Deduction record not found" };
    if (record.status !== "PARTIAL" && record.status !== "FAILED") {
      return { error: "Only partial or failed deductions can be recovered" };
    }

    const shortfall = Number(record.shortfall) || 0;
    if (shortfall <= 0) return { error: "This deduction has no outstanding shortfall" };

    const recovery = Math.round(Math.min(amount, shortfall) * 100) / 100;
    const remainingShortfall = Math.round((shortfall - recovery) * 100) / 100;

    let schedule: ScheduleRow | null = null;
    let alreadyPaid = 0;

    if (record.schedule_id) {
      const { data } = await this.supabase
        .from("loan_schedules")
        .select(
          "id, loan_application_id, month_number, due_date, status, total_payment, paid_amount, interest_payment"
        )
        .eq("id", record.schedule_id)
        .single();
      schedule = (data as ScheduleRow & { interest_payment: number }) ?? null;
      alreadyPaid = Number(schedule?.paid_amount) || 0;
    }

    // Post the accounting entry first: if the ledger rejects the transaction
    // (e.g. unbalanced entries) no financial record has been mutated yet.
    let ledgerReference: string | null = null;
    if (record.loan_application_id && record.schedule_id && recovery > 0) {
      const scheduleInterest = Number(
        (schedule as (ScheduleRow & { interest_payment?: number }) | null)?.interest_payment
      ) || 0;

      // Allocate the recovery to interest first, but only the interest that
      // the earlier deduction did not already cover.
      const interestAlreadyCovered = Math.min(scheduleInterest, alreadyPaid);
      const interestRemaining = Math.max(0, scheduleInterest - interestAlreadyCovered);
      const interestPortion = Math.min(interestRemaining, recovery);
      const principalPortion = Math.round((recovery - interestPortion) * 100) / 100;

      const ledger = await LedgerService.create();
      const ledgerResult = await ledger.postLoanRepayment(
        record.employee_id,
        record.loan_application_id,
        recovery,
        principalPortion,
        interestPortion
      );
      if (ledgerResult.error) {
        return { error: `Could not post recovery to the ledger: ${ledgerResult.error}` };
      }
      ledgerReference = ledgerResult.reference ?? null;
    }

    if (schedule) {
      const newPaid = Math.round((alreadyPaid + recovery) * 100) / 100;
      const isSettled = newPaid >= Number(schedule.total_payment) - 0.005;

      const { error } = await this.supabase
        .from("loan_schedules")
        .update({
          paid_amount: newPaid,
          status: isSettled ? "PAID" : "LATE",
          paid_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      if (error) return { error: error.message };
    }

    const newActual = Math.round(((Number(record.actual_amount) || 0) + recovery) * 100) / 100;
    const newStatus = remainingShortfall <= 0.005 ? "PROCESSED" : "PARTIAL";
    const noteLine = `Recovered ₦${recovery.toLocaleString()}${
      note ? ` — ${note}` : ""
    } on ${new Date().toISOString().slice(0, 10)}`;

    const { error: updateError } = await this.supabase
      .from("deduction_records")
      .update({
        actual_amount: newActual,
        shortfall: remainingShortfall,
        remaining_balance: Math.max(
          0,
          Math.round(((Number(record.remaining_balance) || 0) - recovery) * 100) / 100
        ),
        status: newStatus,
        notes: record.notes ? `${record.notes}\n${noteLine}` : noteLine,
      })
      .eq("id", deductionRecordId)
      .eq("organization_id", this.orgId!);

    if (updateError) return { error: updateError.message };

    if (record.loan_application_id && recovery > 0) {
      const fund = await (await import("./fund-service")).FundService.create();
      const fundAccounts = await fund.listFundAccounts();
      const primaryFund = fundAccounts.find((account) => account.status === "ACTIVE");
      if (primaryFund) {
        await fund.recordMovement(
          primaryFund.id,
          "REPAYMENT",
          recovery,
          "IN",
          `Shortfall recovery #${deductionRecordId.slice(0, 8)}`,
          record.loan_application_id
        );
      }

      await this.completeLoanIfSettled(record.loan_application_id);
    }

    await this.audit(
      "collections.shortfall_recovered",
      "deduction",
      deductionRecordId,
      { shortfall, actualAmount: Number(record.actual_amount) || 0, status: record.status },
      {
        recovered: recovery,
        shortfall: remainingShortfall,
        actualAmount: newActual,
        status: newStatus,
        note: note ?? null,
        ledgerReference,
      }
    );

    return {
      success:
        remainingShortfall <= 0.005
          ? `Shortfall cleared. ₦${recovery.toLocaleString()} recovered.`
          : `₦${recovery.toLocaleString()} recovered. ₦${remainingShortfall.toLocaleString()} still outstanding.`,
      status: newStatus,
      remainingShortfall,
    };
  }

  /**
   * Forgive the outstanding shortfall on a deduction. This is an explicit,
   * audited decision — never an automatic write-off.
   */
  async waiveShortfall(deductionRecordId: string, reason: string) {
    if (!this.canManageCollections() || !this.userId) return { error: "Unauthorized" };
    if (!reason.trim()) return { error: "A waiver reason is required" };

    const { data: record } = await this.supabase
      .from("deduction_records")
      .select("*")
      .eq("id", deductionRecordId)
      .eq("organization_id", this.orgId!)
      .single();

    if (!record) return { error: "Deduction record not found" };
    if (record.status !== "PARTIAL" && record.status !== "FAILED") {
      return { error: "Only partial or failed deductions can be waived" };
    }

    const shortfall = Number(record.shortfall) || 0;
    if (shortfall <= 0) return { error: "This deduction has no outstanding shortfall" };

    const noteLine = `Waived ₦${shortfall.toLocaleString()} — ${reason.trim()} on ${new Date()
      .toISOString()
      .slice(0, 10)}`;

    const { error } = await this.supabase
      .from("deduction_records")
      .update({
        shortfall: 0,
        remaining_balance: 0,
        status: "WAIVED",
        notes: record.notes ? `${record.notes}\n${noteLine}` : noteLine,
      })
      .eq("id", deductionRecordId)
      .eq("organization_id", this.orgId!);

    if (error) return { error: error.message };

    if (record.schedule_id) {
      await this.supabase
        .from("loan_schedules")
        .update({ status: "WAIVED" })
        .eq("id", record.schedule_id);
    }

    if (record.loan_application_id) {
      await this.completeLoanIfSettled(record.loan_application_id);
    }

    await this.audit(
      "collections.shortfall_waived",
      "deduction",
      deductionRecordId,
      { shortfall, status: record.status },
      { shortfall: 0, status: "WAIVED", reason: reason.trim() }
    );

    return { success: `₦${shortfall.toLocaleString()} shortfall waived.` };
  }

  private async completeLoanIfSettled(loanApplicationId: string) {
    const { data: schedules } = await this.supabase
      .from("loan_schedules")
      .select("status")
      .eq("loan_application_id", loanApplicationId);

    if (!schedules || schedules.length === 0) return;

    const settled = schedules.every(
      (schedule) => schedule.status === "PAID" || schedule.status === "WAIVED"
    );
    if (!settled) return;

    const { data: loan } = await this.supabase
      .from("loan_applications")
      .select("status")
      .eq("id", loanApplicationId)
      .eq("organization_id", this.orgId!)
      .single();

    if (!loan || loan.status === "COMPLETED") return;

    await this.supabase
      .from("loan_applications")
      .update({ status: "COMPLETED" })
      .eq("id", loanApplicationId)
      .eq("organization_id", this.orgId!);

    await this.audit(
      "loan.completed",
      "loan_application",
      loanApplicationId,
      { status: loan.status },
      { status: "COMPLETED" }
    );
  }
}
