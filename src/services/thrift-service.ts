import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * Employee thrift savings.
 *
 * The employer and employee agree a monthly thrift amount. Salaries are paid
 * outside the app; the employer withholds that amount and records a monthly
 * thrift funding here. Each funding is split: the employee's active loan
 * instalment is settled first and the remainder is added to thrift savings.
 *
 * Employees cannot withdraw thrift directly - the chairman releases it into the
 * withdrawable wallet after a request.
 */

export const THRIFT_FUNDING_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
]);

export const THRIFT_APPROVER_ROLES = new Set(["ORGANIZATION_OWNER"]);

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);

const round2 = (value: number) => Math.round(value * 100) / 100;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function currentPeriodMonth() {
  const now = new Date();
  return isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

export function normalizePeriodMonth(value?: string | null) {
  if (!value) return currentPeriodMonth();
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function periodLabel(periodMonth: string) {
  return new Date(`${periodMonth}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface ThriftFundingResult {
  ok: boolean;
  error?: string;
  amount?: number;
  loanRepayment?: number;
  thriftCredit?: number;
  reference?: string;
  warning?: string;
}

export class ThriftService {
  private constructor(
    private supabase: Awaited<ReturnType<typeof createClient>>,
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

    return new ThriftService(supabase, user?.id ?? null, organizationId, role);
  }

  private async ensureStaff() {
    if (!this.userId || !this.organizationId) return "Unauthorized";
    if (!this.role || !THRIFT_FUNDING_ROLES.has(this.role)) {
      return "Only the chairman or an admin can fund thrift savings";
    }
    return null;
  }

  private async ensureOwner() {
    if (!this.userId || !this.organizationId) {
      return "Unauthorized";
    }
    if (!this.role || !THRIFT_APPROVER_ROLES.has(this.role)) {
      return "Only the chairman can approve thrift savings payouts";
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

  /** Employees, their thrift amount, balance and current-month funding state. */
  async getOverview(periodMonthInput?: string | null) {
    if (!this.organizationId) return null;

    const periodMonth =
      normalizePeriodMonth(periodMonthInput) ?? currentPeriodMonth();

    const admin = createAdminClient();
    const { data: employees } = await admin
      .from("employees")
      .select(
        "id, first_name, last_name, employee_number, thrift_enabled, thrift_amount"
      )
      .eq("organization_id", this.organizationId)
      .eq("employment_status", "Active")
      .order("first_name", { ascending: true });

    const list = employees ?? [];
    const ledger = this.ledger();

    const { data: fundings } = await admin
      .from("thrift_fundings")
      .select("employee_id, amount, loan_repayment_applied, thrift_credit")
      .eq("organization_id", this.organizationId)
      .eq("period_month", periodMonth);

    const fundedByEmployee = new Map(
      (fundings ?? []).map((funding) => [funding.employee_id as string, funding])
    );

    const { data: activeLoans } = await admin
      .from("loan_applications")
      .select("id, employee_id, monthly_deduction, total_repayment, status")
      .eq("organization_id", this.organizationId)
      .in("status", ["ACTIVE", "DISBURSED"]);

    const loanByEmployee = new Map<
      string,
      { id: string; monthly: number }
    >();
    for (const loan of activeLoans ?? []) {
      const employeeKey = loan.employee_id as string;
      const monthly = Number(loan.monthly_deduction) || 0;
      const existing = loanByEmployee.get(employeeKey);
      if (existing) {
        existing.monthly = round2(existing.monthly + monthly);
      } else {
        loanByEmployee.set(employeeKey, {
          id: loan.id as string,
          monthly,
        });
      }
    }

    const rows = await Promise.all(
      list.map(async (employee) => {
        const balance = ledger
          ? await ledger.getThriftBalance(employee.id)
          : 0;
        const funding = fundedByEmployee.get(employee.id as string);
        const loan = loanByEmployee.get(employee.id as string);

        return {
          id: employee.id as string,
          name: `${employee.first_name} ${employee.last_name}`,
          employeeNumber: employee.employee_number as string,
          enabled: Boolean(employee.thrift_enabled),
          amount: Number(employee.thrift_amount) || 0,
          balance,
          fundedThisMonth: Boolean(funding),
          fundedAmount: Number(funding?.amount) || 0,
          loanRepayment: Number(funding?.loan_repayment_applied) || 0,
          activeLoanMonthly: loan?.monthly ?? 0,
          activeLoanId: loan?.id ?? null,
        };
      })
    );

    const totalSavings = rows.reduce((sum, row) => sum + row.balance, 0);
    const monthlyThrift = rows.reduce(
      (sum, row) => sum + (row.enabled ? row.amount : 0),
      0
    );
    const fundedTotal = rows.reduce((sum, row) => sum + row.fundedAmount, 0);

    return {
      periodMonth,
      periodLabel: periodLabel(periodMonth),
      employees: rows,
      totals: {
        savings: round2(totalSavings),
        monthlyThrift: round2(monthlyThrift),
        fundedThisMonth: round2(fundedTotal),
        fundedCount: rows.filter((row) => row.fundedThisMonth).length,
        employeeCount: rows.length,
        activeLoans: rows.filter((row) => row.activeLoanId).length,
      },
    };
  }

  /** Funding history for the organization. */
  async listFundings(limit = 100) {
    if (!this.organizationId) return [];

    const admin = createAdminClient();
    const { data } = await admin
      .from("thrift_fundings")
      .select(
        `
        id,
        employee_id,
        period_month,
        amount,
        loan_repayment_applied,
        thrift_credit,
        reference,
        status,
        notes,
        created_at,
        employees:employee_id(first_name, last_name, employee_number)
      `
      )
      .eq("organization_id", this.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => {
      const employee = row.employees as unknown as {
        first_name: string;
        last_name: string;
        employee_number: string;
      } | null;

      return {
        id: row.id as string,
        employeeId: row.employee_id as string,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Employee",
        employeeNumber: employee?.employee_number ?? "",
        periodMonth: row.period_month as string,
        periodLabel: periodLabel(row.period_month as string),
        amount: Number(row.amount) || 0,
        loanRepayment: Number(row.loan_repayment_applied) || 0,
        thriftCredit: Number(row.thrift_credit) || 0,
        reference: row.reference as string,
        status: row.status as string,
        notes: row.notes as string | null,
        createdAt: row.created_at as string,
      };
    });
  }

  /** Employee's own funding history and current savings position. */
  async getMySummary() {
    const employee = await this.getMyEmployee();
    if (!employee?.id || !employee.organization_id) return null;

    const admin = createAdminClient();
    const ledger = LedgerService.createForOrganization(employee.organization_id);
    const [balance, fundings, loan] = await Promise.all([
      ledger.getThriftBalance(employee.id),
      admin
        .from("thrift_fundings")
        .select(
          "id, period_month, amount, loan_repayment_applied, thrift_credit, reference, status, created_at"
        )
        .eq("employee_id", employee.id)
        .order("period_month", { ascending: false })
        .limit(50),
      admin
        .from("loan_applications")
        .select("id, monthly_deduction, total_repayment, status, loan_products(name)")
        .eq("employee_id", employee.id)
        .in("status", ["ACTIVE", "DISBURSED"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const product = loan.data?.loan_products as unknown as
      | { name: string }
      | null;

    return {
      employeeId: employee.id as string,
      amount: Number(employee.thrift_amount) || 0,
      enabled: Boolean(employee.thrift_enabled),
      balance,
      loan: loan.data
        ? {
            id: loan.data.id as string,
            productName: product?.name ?? "Loan",
            monthlyDeduction: Number(loan.data.monthly_deduction) || 0,
            totalRepayment: Number(loan.data.total_repayment) || 0,
          }
        : null,
      fundings: (fundings.data ?? []).map((funding) => ({
        id: funding.id as string,
        periodMonth: funding.period_month as string,
        periodLabel: periodLabel(funding.period_month as string),
        amount: Number(funding.amount) || 0,
        loanRepayment: Number(funding.loan_repayment_applied) || 0,
        thriftCredit: Number(funding.thrift_credit) || 0,
        reference: funding.reference as string,
        status: funding.status as string,
        createdAt: funding.created_at as string,
      })),
    };
  }

  /**
   * Record one employer-funded thrift contribution for an employee.
   *
   * The full contribution is credited to thrift savings first. If the employee
   * has an active loan, the contribution is then applied to the next unpaid
   * instalments, leaving the employee's accumulated savings intact.
   */
  async fundEmployee(
    employeeId: string,
    periodMonthInput?: string | null,
    amountInput?: number,
    notes?: string
  ): Promise<ThriftFundingResult> {
    const forbidden = await this.ensureStaff();
    if (forbidden) return { ok: false, error: forbidden };
    if (!this.organizationId) {
      return { ok: false, error: "No organization found" };
    }

    const periodMonth = normalizePeriodMonth(periodMonthInput);
    if (!periodMonth) {
      return { ok: false, error: "Choose a valid funding month" };
    }

    const admin = createAdminClient();
    const { data: employee } = await admin
      .from("employees")
      .select(
        "id, first_name, last_name, organization_id, thrift_enabled, thrift_amount"
      )
      .eq("id", employeeId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!employee) {
      return { ok: false, error: "Employee not found" };
    }

    if (!employee.thrift_enabled) {
      return {
        ok: false,
        error: `${employee.first_name}'s thrift is switched off. Set a monthly thrift amount before funding.`,
      };
    }

    const amount = round2(Number(amountInput ?? employee.thrift_amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: "Enter a valid thrift amount. Set the employee's thrift amount first.",
      };
    }

    const { data: existing } = await admin
      .from("thrift_fundings")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("period_month", periodMonth)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error: `${employee.first_name} already has thrift funding for ${periodLabel(
          periodMonth
        )}`,
      };
    }

    const ledger = this.ledger();
    if (!ledger) return { ok: false, error: "No organization found" };

    const reference = `SLF-THRIFT-${employeeId}-${periodMonth.replace(/-/g, "")}`;

    const { data: funding, error: fundingError } = await admin
      .from("thrift_fundings")
      .insert({
        organization_id: this.organizationId,
        employee_id: employeeId,
        period_month: periodMonth,
        amount,
        reference,
        notes: notes?.trim() || null,
        funded_by: this.userId,
      })
      .select("id")
      .single();

    if (fundingError) {
      return { ok: false, error: fundingError.message };
    }

    const posted = await ledger.postThriftFunding(
      employeeId,
      reference,
      amount,
      `Thrift funding for ${periodLabel(periodMonth)}`
    );
    if (posted.error) {
      await admin.from("thrift_fundings").delete().eq("id", funding.id);
      return { ok: false, error: posted.error };
    }

    const applied = await this.applyLoanRepayments(
      employeeId,
      amount,
      reference,
      periodMonth
    );

    const thriftCredit = round2(amount - applied.total);

    const { error: splitError } = await admin
      .from("thrift_fundings")
      .update({
        loan_repayment_applied: applied.total,
        thrift_credit: thriftCredit,
      })
      .eq("id", funding.id);

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "thrift.funded",
      entityType: "thrift_funding",
      entityId: funding.id,
      after: {
        employee: `${employee.first_name} ${employee.last_name}`,
        periodMonth,
        amount,
        loanRepayment: applied.total,
        thriftCredit,
        reference,
      },
    });

    return {
      ok: true,
      amount,
      loanRepayment: applied.total,
      thriftCredit,
      reference,
      warning: splitError?.message ?? applied.warning,
    };
  }

  /**
   * Fund the agreed thrift amount for every active employee who has not been
   * funded for the chosen month. Idempotent per employee and month.
   */
  async fundAll(periodMonthInput?: string | null, notes?: string) {
    const forbidden = await this.ensureStaff();
    if (forbidden) return { ok: false, error: forbidden };

    const periodMonth = normalizePeriodMonth(periodMonthInput);
    if (!periodMonth) {
      return { ok: false, error: "Choose a valid funding month" };
    }
    if (!this.organizationId) {
      return { ok: false, error: "No organization found" };
    }

    const admin = createAdminClient();
    const { data: employees } = await admin
      .from("employees")
      .select("id, first_name, last_name, thrift_enabled, thrift_amount")
      .eq("organization_id", this.organizationId)
      .eq("employment_status", "Active")
      .eq("thrift_enabled", true)
      .gt("thrift_amount", 0);

    let funded = 0;
    let skipped = 0;
    let failed = 0;
    let total = 0;
    let loanRepayment = 0;
    const failures: string[] = [];

    for (const employee of employees ?? []) {
      const result = await this.fundEmployee(
        employee.id,
        periodMonth,
        Number(employee.thrift_amount),
        notes
      );

      if (result.ok) {
        funded += 1;
        total += result.amount ?? 0;
        loanRepayment += result.loanRepayment ?? 0;
      } else if (result.error?.includes("already has thrift funding")) {
        skipped += 1;
      } else {
        failed += 1;
        failures.push(
          `${employee.first_name} ${employee.last_name}: ${result.error}`
        );
      }
    }

    return {
      ok: true,
      periodMonth,
      periodLabel: periodLabel(periodMonth),
      funded,
      skipped,
      failed,
      total: round2(total),
      loanRepayment: round2(loanRepayment),
      failures,
    };
  }

  /**
   * Apply a funded amount to the employee's active loan instalments. Returns
   * the amount actually repaid; the remainder stays in thrift savings.
   */
  private async applyLoanRepayments(
    employeeId: string,
    amount: number,
    reference: string,
    periodMonth: string
  ): Promise<{ total: number; warning?: string }> {
    if (!this.organizationId) return { total: 0 };

    const admin = createAdminClient();
    const ledger = this.ledger();
    if (!ledger) return { total: 0 };

    const { data: loans } = await admin
      .from("loan_applications")
      .select("id, status, monthly_deduction")
      .eq("organization_id", this.organizationId)
      .eq("employee_id", employeeId)
      .in("status", ["ACTIVE", "DISBURSED"])
      .order("created_at", { ascending: true });

    let remaining = round2(amount);
    let totalApplied = 0;
    let warning: string | undefined;

    for (const loan of loans ?? []) {
      if (remaining <= 0) break;

      const { data: schedules } = await admin
        .from("loan_schedules")
        .select(
          "id, month_number, total_payment, interest_payment, paid_amount, paid_at, status, due_date"
        )
        .eq("loan_application_id", loan.id)
        .order("month_number", { ascending: true });

      for (const schedule of schedules ?? []) {
        if (remaining <= 0) break;
        if (schedule.status === "PAID" || schedule.status === "WAIVED") continue;

        const dueAmount = round2(
          Number(schedule.total_payment) - Number(schedule.paid_amount || 0)
        );
        if (dueAmount <= 0) continue;

        const applied = round2(Math.min(dueAmount, remaining));
        const newPaid = round2(Number(schedule.paid_amount || 0) + applied);
        const fullyPaid = newPaid >= Number(schedule.total_payment) - 0.0001;
        const dueDate = schedule.due_date ? String(schedule.due_date) : null;
        const overdue = dueDate ? dueDate < isoDay(new Date()) : false;

        const { error: scheduleError } = await admin
          .from("loan_schedules")
          .update({
            paid_amount: newPaid,
            status: fullyPaid ? "PAID" : overdue ? "LATE" : schedule.status,
            paid_at: fullyPaid ? new Date().toISOString() : null,
          })
          .eq("id", schedule.id);

        if (scheduleError) {
          warning = scheduleError.message;
          break;
        }

        const repaymentReference = `${reference}-${schedule.month_number}`;
        const { error: repaymentError } = await admin
          .from("loan_repayments")
          .insert({
            loan_application_id: loan.id,
            schedule_id: schedule.id,
            amount: applied,
            payment_method: "THRIFT_FUNDING",
            reference_number: repaymentReference,
            notes: `Settled from ${periodLabel(periodMonth)} thrift funding`,
            recorded_by: this.userId,
          });

        if (repaymentError) {
          warning = repaymentError.message;
          break;
        }

        const interest = Math.min(Number(schedule.interest_payment) || 0, applied);
        const principal = round2(applied - interest);

        const ledgerResult = await ledger.postThriftLoanRepayment(
          employeeId,
          loan.id,
          applied,
          principal,
          interest,
          repaymentReference
        );

        if (ledgerResult.error) {
          warning = ledgerResult.error;

          // Keep the loan record consistent with the ledger: undo the
          // schedule update and remove the repayment row.
          await admin
            .from("loan_schedules")
            .update({
              paid_amount: Number(schedule.paid_amount || 0),
              status: schedule.status,
              paid_at: schedule.paid_at ?? null,
            })
            .eq("id", schedule.id);
          await admin
            .from("loan_repayments")
            .delete()
            .eq("reference_number", repaymentReference);
          break;
        }

        remaining = round2(remaining - applied);
        totalApplied = round2(totalApplied + applied);
      }

      const { data: allSchedules } = await admin
        .from("loan_schedules")
        .select("status")
        .eq("loan_application_id", loan.id);

      if (
        allSchedules &&
        allSchedules.length > 0 &&
        allSchedules.every((entry) => entry.status === "PAID")
      ) {
        await admin
          .from("loan_applications")
          .update({ status: "COMPLETED" })
          .eq("id", loan.id)
          .eq("organization_id", this.organizationId);
      }
    }

    return { total: totalApplied, warning };
  }

  private async getMyEmployee() {
    if (!this.userId) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("employees")
      .select(
        "id, organization_id, first_name, last_name, thrift_enabled, thrift_amount"
      )
      .eq("user_id", this.userId)
      .maybeSingle();
    return data ?? null;
  }

  /**
   * Employer sets an employee's agreed monthly thrift contribution. This is
   * the amount withheld and funded each month, and the ceiling for the
   * employee's monthly loan repayment.
   */
  async updateEmployeeThriftAmount(employeeId: string, value: number) {
    const forbidden = await this.ensureStaff();
    if (forbidden) return { ok: false as const, error: forbidden };
    if (!this.organizationId) {
      return { ok: false as const, error: "No organization found" };
    }

    const amount = round2(Number(value));
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false as const, error: "Enter a valid thrift amount" };
    }

    const admin = createAdminClient();
    const { data: employee, error: loadError } = await admin
      .from("employees")
      .select(
        "id, first_name, last_name, organization_id, thrift_enabled, thrift_amount"
      )
      .eq("id", employeeId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (loadError) return { ok: false as const, error: loadError.message };
    if (!employee) return { ok: false as const, error: "Employee not found" };

    const { data: activeLoans } = await admin
      .from("loan_applications")
      .select("monthly_deduction")
      .eq("employee_id", employee.id)
      .eq("organization_id", this.organizationId)
      .in("status", ["ACTIVE", "DISBURSED"]);

    const monthlyRepayment = round2(
      (activeLoans ?? []).reduce(
        (sum, loan) => sum + (Number(loan.monthly_deduction) || 0),
        0
      )
    );
    if (monthlyRepayment > 0 && amount < monthlyRepayment) {
      return {
        ok: false as const,
        error: `${employee.first_name}'s active loan repayments total ${naira(
          monthlyRepayment
        )} per month. Their thrift amount cannot be less than that.`,
      };
    }

    const before = {
      thriftEnabled: Boolean(employee.thrift_enabled),
      thriftAmount: Number(employee.thrift_amount) || 0,
    };

    const { error } = await admin
      .from("employees")
      .update({
        thrift_enabled: amount > 0,
        thrift_amount: amount,
      })
      .eq("id", employee.id)
      .eq("organization_id", this.organizationId);

    if (error) return { ok: false as const, error: error.message };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "employee.thrift_updated_by_employer",
      entityType: "employee",
      entityId: employee.id,
      before,
      after: { thriftEnabled: amount > 0, thriftAmount: amount },
    });

    return {
      ok: true as const,
      success:
        amount > 0
          ? `${employee.first_name}'s monthly thrift set to ${naira(amount)}`
          : `${employee.first_name}'s thrift switched off for future funding`,
      amount,
    };
  }

  /** Employee asks the employer to release some or all of their thrift. */
  async requestRelease(amount: number) {
    if (!this.userId) return { ok: false as const, error: "Sign in to continue" };

    const employee = await this.getMyEmployee();
    if (!employee?.id || !employee.organization_id) {
      return {
        ok: false as const,
        error: "No employee profile is linked to this account",
      };
    }

    const requested = round2(Number(amount));
    if (!Number.isFinite(requested) || requested <= 0) {
      return { ok: false as const, error: "Enter a valid amount" };
    }

    const ledger = LedgerService.createForOrganization(employee.organization_id);
    const balance = await ledger.getThriftBalance(employee.id);
    if (requested > balance) {
      return {
        ok: false as const,
        error: `You can request up to ${naira(balance)}`,
      };
    }

    const admin = createAdminClient();
    const { data: pending } = await admin
      .from("thrift_release_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "PENDING")
      .maybeSingle();

    if (pending) {
      return {
        ok: false as const,
        error: "You already have a pending thrift release request",
      };
    }

    const { error } = await admin.from("thrift_release_requests").insert({
      organization_id: employee.organization_id,
      employee_id: employee.id,
      amount: requested,
      status: "PENDING",
      requested_by: this.userId,
    });

    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, success: "Release request sent to your employer" };
  }

  /** Employee's own thrift release requests. */
  async listMyRequests() {
    const employee = await this.getMyEmployee();
    if (!employee?.id) return [];
    const admin = createAdminClient();
    const { data } = await admin
      .from("thrift_release_requests")
      .select("id, amount, status, notes, reviewed_at, created_at")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  /** Employer view of thrift release requests. */
  async listRequests() {
    if (!this.organizationId) return [];
    const admin = createAdminClient();
    const { data } = await admin
      .from("thrift_release_requests")
      .select(
        "id, employee_id, amount, status, notes, reviewed_at, created_at, employees:employee_id(first_name, last_name, employee_number)"
      )
      .eq("organization_id", this.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    return (data ?? []).map((row) => {
      const employee = row.employees as unknown as {
        first_name: string;
        last_name: string;
        employee_number: string;
      } | null;
      return {
        id: row.id as string,
        amount: Number(row.amount) || 0,
        status: row.status as string,
        notes: row.notes as string | null,
        reviewedAt: row.reviewed_at as string | null,
        createdAt: row.created_at as string,
        employeeId: row.employee_id as string,
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Employee",
        employeeNumber: employee?.employee_number ?? "",
      };
    });
  }

  /** Chairman approves (releases individually) or rejects a request. */
  async reviewRequest(id: string, approve: boolean, notes?: string) {
    const forbidden = await this.ensureOwner();
    if (forbidden) return { ok: false as const, error: forbidden };
    if (!this.organizationId || !this.userId) {
      return { ok: false as const, error: "Unauthorized" };
    }

    const admin = createAdminClient();
    const { data: request } = await admin
      .from("thrift_release_requests")
      .select("id, employee_id, amount, status")
      .eq("id", id)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!request) return { ok: false as const, error: "Request not found" };
    if (request.status !== "PENDING") {
      return {
        ok: false as const,
        error: "This request has already been handled",
      };
    }

    if (!approve) {
      const { error } = await admin
        .from("thrift_release_requests")
        .update({
          status: "REJECTED",
          notes: notes ?? "Rejected by the chairman",
          reviewed_by: this.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    }

    const ledger = this.ledger();
    if (!ledger) return { ok: false as const, error: "No organization found" };

    const requested = Number(request.amount) || 0;
    const balance = await ledger.getThriftBalance(request.employee_id as string);
    if (balance < requested) {
      return {
        ok: false as const,
        error: `This employee's thrift balance is now ${naira(
          balance
        )}, below the requested ${naira(
          requested
        )}. Reject the request or release the available balance from the employee's profile.`,
      };
    }

    const result = await this.releaseToWallet(
      request.employee_id as string,
      requested
    );
    if (!result.ok) return { ok: false as const, error: result.error };

    const { error } = await admin
      .from("thrift_release_requests")
      .update({
        status: "PAID",
        reviewed_by: this.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const };
  }

  /** Chairman releases thrift savings into the employee's withdrawable wallet. */
  async releaseToWallet(employeeId: string, amount?: number) {
    const forbidden = await this.ensureOwner();
    if (forbidden) return { ok: false, error: forbidden };
    if (!this.organizationId) {
      return { ok: false, error: "No organization found" };
    }

    const admin = createAdminClient();
    const { data: employee } = await admin
      .from("employees")
      .select("id, first_name, last_name")
      .eq("id", employeeId)
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (!employee) return { ok: false, error: "Employee not found" };

    const ledger = LedgerService.createForOrganization(
      this.organizationId,
      this.userId
    );
    const balance = await ledger.getThriftBalance(employeeId);
    if (balance <= 0) {
      return { ok: false, error: "There is no thrift savings to release" };
    }

    const payout = Math.min(amount ?? balance, balance);
    if (payout <= 0) {
      return { ok: false, error: "Enter a valid amount" };
    }

    const reference = `SLF-THRIFT-PAYOUT-${employeeId.slice(0, 8)}-${Date.now()}`;
    const posted = await ledger.postThriftPayout(employeeId, reference, payout);
    if (posted.error) return { ok: false, error: posted.error };

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "thrift.released",
      entityType: "employee",
      entityId: employeeId,
      after: {
        employee: `${employee.first_name} ${employee.last_name}`,
        amount: payout,
        reference,
      },
    });

    return { ok: true, amount: payout, reference };
  }

  /** Chairman releases every employee's thrift savings in one action. */
  async releaseAllToWallet() {
    const forbidden = await this.ensureOwner();
    if (forbidden) return { ok: false, error: forbidden };
    if (!this.organizationId) {
      return { ok: false, error: "No organization found" };
    }

    const admin = createAdminClient();
    const ledger = this.ledger();
    if (!ledger) return { ok: false, error: "No organization found" };

    // Include former employees too: their thrift savings still belong to them
    // even after they leave the active workforce.
    const { data: employees } = await admin
      .from("employees")
      .select("id")
      .eq("organization_id", this.organizationId);

    let released = 0;
    let total = 0;
    let failures = 0;

    for (const employee of employees ?? []) {
      const balance = await ledger.getThriftBalance(employee.id as string);
      if (balance <= 0) continue;

      const result = await this.releaseToWallet(
        employee.id as string,
        balance
      );
      if (!result.ok) {
        failures += 1;
        continue;
      }
      released += 1;
      total += result.amount ?? balance;
    }

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "thrift.released_all",
      entityType: "organization",
      entityId: this.organizationId,
      after: { released, total: round2(total), failures },
    });

    return {
      ok: true,
      released,
      total: round2(total),
      failures,
    };
  }
}
