import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "./audit-service";

/**
 * Delinquency and collections handling.
 *
 * Loans become delinquent when a scheduled installment passes its due date
 * without full payment. A sweep promotes schedules to LATE, flags loans that
 * are 90+ days overdue as DEFAULTED, and surfaces everything on a collections
 * dashboard so the team can follow up.
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


export interface CollectionsSummary {
  delinquentLoans: number;
  defaultedLoans: number;
  totalOverdue: number;
  totalOutstanding: number;
  averageDaysPastDue: number;
  buckets: Record<RiskBucket, { count: number; amount: number }>;
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
        department: employee?.department ?? "â€”",
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
      };
    }

    const loans = await this.listDelinquentLoans();

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
    };
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
