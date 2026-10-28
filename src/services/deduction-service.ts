import { createClient } from "@/lib/supabase/server";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

export interface PayrollRow {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  grossSalary: number;
  loanDeduction: number;
  otherDeduction: number;
  netSalary: number;
  status: string;
}

/**
 * Automated salary deduction engine per spec #50.
 *
 * find active loans -> find current repayment schedule -> calculate due amount
 * -> check deduction limit -> create deduction -> update repayment -> update
 * loan balance -> create ledger entries -> notify employee.
 */
export class DeductionService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;
  private userId: string | null = null;

  private constructor(
    supabase: Awaited<ReturnType<typeof createClient>>
  ) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let orgId: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      orgId = profile?.organization_id ?? null;
    }

    const service = new DeductionService(supabase);
    service.orgId = orgId;
    service.userId = user?.id ?? null;
    return service;
  }

  /**
   * Generate scheduled deduction records for all active loans in the org
   * linked to a salary period. For each active loan, pick the earliest
   * unpaid schedule entry and create a deduction record (idempotent by
   * unique(salary_period_id, employee_id, loan_application_id)).
   */
  async generateScheduledDeductions(periodId: string) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: activeLoans } = await this.supabase
      .from("loan_applications")
      .select("id, employee_id")
      .eq("organization_id", this.orgId)
      .eq("status", "ACTIVE");

    if (!activeLoans || activeLoans.length === 0) {
      return { success: "No active loans to deduct", count: 0 };
    }

    let created = 0;

    for (const loan of activeLoans) {
      const { data: schedule } = await this.supabase
        .from("loan_schedules")
        .select("*")
        .eq("loan_application_id", loan.id)
        .in("status", ["UPCOMING", "DUE", "LATE"])
        .order("month_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!schedule) continue;

      const reference = `SLF-DED-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { data: existing } = await this.supabase
        .from("deduction_records")
        .select("id")
        .eq("salary_period_id", periodId)
        .eq("employee_id", loan.employee_id)
        .eq("loan_application_id", loan.id)
        .maybeSingle();

      if (existing) continue;

      const remainingBalance = Number(schedule.closing_balance ?? 0);
      const expectedAmount = Number(schedule.total_payment) - Number(schedule.paid_amount);

      const { error } = await this.supabase.from("deduction_records").insert({
        organization_id: this.orgId,
        salary_period_id: periodId,
        employee_id: loan.employee_id,
        loan_application_id: loan.id,
        schedule_id: schedule.id,
        deduction_type: "LOAN",
        expected_amount: expectedAmount,
        remaining_balance: remainingBalance || expectedAmount,
        reference,
        status: "PENDING",
      });

      if (!error) created++;
    }

    if (created > 0) {
      await recordAudit({
        organizationId: this.orgId,
        userId: this.userId,
        action: "payroll.deductions_generated",
        entityType: "salary_period",
        entityId: periodId,
        after: { count: created },
      });
    }

    return { success: `Generated ${created} deduction record(s)`, count: created };
  }

  /**
   * Process one deduction record with the actual deducted amount.
   * Full amount -> PAID schedule; Partial -> PARTIAL + shortfall; records
   * ledger entries via LedgerService.
   */
  async processDeduction(deductionRecordId: string, actualAmount: number) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: record } = await this.supabase
      .from("deduction_records")
      .select("*")
      .eq("id", deductionRecordId)
      .eq("organization_id", this.orgId)
      .single();

    if (!record) return { error: "Deduction record not found" };
    if (record.status === "PROCESSED") return { error: "Deduction already processed" };

    const expected = Number(record.expected_amount);
    const actual = Math.min(actualAmount, expected);
    const shortfall = Math.round((expected - actual) * 100) / 100;
    const isFull = shortfall <= 0.005;

    // Update schedule status
    if (record.schedule_id) {
      const { data: schedule } = await this.supabase
        .from("loan_schedules")
        .select("*")
        .eq("id", record.schedule_id)
        .single();

      if (schedule) {
        const newPaidAmount = Number(schedule.paid_amount) + actual;
        const scheduleStatus = isFull
          ? "PAID"
          : newPaidAmount > 0
            ? "LATE"
            : schedule.status;

        await this.supabase
          .from("loan_schedules")
          .update({
            paid_amount: newPaidAmount,
            status: scheduleStatus,
            paid_at: actual > 0 ? new Date().toISOString() : schedule.paid_at,
          })
          .eq("id", record.schedule_id);
      }
    }

    // Update deduction record
    const newStatus = isFull ? "PROCESSED" : actual > 0 ? "PARTIAL" : "FAILED";
    const { error: updateError } = await this.supabase
      .from("deduction_records")
      .update({
        actual_amount: actual,
        shortfall,
        status: newStatus,
        processed_at: new Date().toISOString(),
        notes: isFull
          ? undefined
          : `Expected ₦${expected.toLocaleString()}, deducted ₦${actual.toLocaleString()}, shortfall ₦${shortfall.toLocaleString()}`,
      })
      .eq("id", deductionRecordId)
      .eq("organization_id", this.orgId);

    if (updateError) return { error: updateError.message };

    // Check if all schedule entries now paid -> complete loan
    if (record.schedule_id) {
      const { data: allSchedule } = await this.supabase
        .from("loan_schedules")
        .select("status")
        .eq("loan_application_id", record.loan_application_id);

      const allPaid =
        allSchedule?.length &&
        allSchedule.every(
          (s) => s.status === "PAID" || s.status === "WAIVED"
        );
      if (allPaid) {
        await this.supabase
          .from("loan_applications")
          .update({ status: "COMPLETED" })
          .eq("id", record.loan_application_id)
          .eq("organization_id", this.orgId);
      }
    }

    // Post ledger entries
    if (actual > 0 && record.schedule_id) {
      const { data: schedule } = await this.supabase
        .from("loan_schedules")
        .select("interest_payment")
        .eq("id", record.schedule_id)
        .single();

      if (schedule) {
        const interestPortion = Math.min(Number(schedule.interest_payment) || 0, actual);
        const principalPortion = actual - interestPortion;

        const ledger = await LedgerService.create();
        const ledgerResult = await ledger.postLoanRepayment(
          record.employee_id,
          record.loan_application_id ?? "",
          actual,
          principalPortion,
          interestPortion
        );
        if (ledgerResult.error) {
          return { error: `Deduction recorded but ledger error: ${ledgerResult.error}` };
        }
      }
    }

    await recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action: "payroll.deduction_processed",
      entityType: "deduction",
      entityId: deductionRecordId,
      before: {
        status: record.status,
        expectedAmount: expected,
        actualAmount: Number(record.actual_amount) || 0,
      },
      after: {
        status: newStatus,
        actualAmount: actual,
        shortfall,
        employeeId: record.employee_id,
        loanApplicationId: record.loan_application_id,
        salaryPeriodId: record.salary_period_id,
      },
    });

    return {
      success: isFull
        ? "Deduction processed in full"
        : `Partial deduction: ₦${actual.toLocaleString()} of ₦${expected.toLocaleString()}`,
      status: newStatus,
    };
  }

  /**
   * Preview the payroll for a salary period: for each employee with a salary
   * record, show gross, loan deduction, other deduction and net.
   */
  async previewPayroll(periodId: string): Promise<PayrollRow[]> {
    if (!this.orgId) return [];

    const { data: salaryRecords } = await this.supabase
      .from("salary_records")
      .select(
        `
        id,
        employee_id,
        basic_salary,
        allowances,
        gross_salary,
        other_deductions,
        employees:employee_id(employee_number, first_name, last_name)
      `
      )
      .eq("salary_period_id", periodId);

    const { data: deductions } = await this.supabase
      .from("deduction_records")
      .select("employee_id, expected_amount")
      .eq("salary_period_id", periodId)
      .eq("organization_id", this.orgId)
      .eq("deduction_type", "LOAN");

    const deductionByEmployee = new Map<string, number>();
    for (const d of deductions ?? []) {
      deductionByEmployee.set(
        d.employee_id,
        (deductionByEmployee.get(d.employee_id) ?? 0) + Number(d.expected_amount)
      );
    }

    const rows: PayrollRow[] = (salaryRecords ?? []).map((record) => {
      const emp = record.employees as unknown as {
        employee_number: string;
        first_name: string;
        last_name: string;
      } | null;

      const gross = Number(record.gross_salary) || Number(record.basic_salary) || 0;
      const other = Number(record.other_deductions) || 0;
      const loan = deductionByEmployee.get(record.employee_id) ?? 0;
      const net = Math.round((gross - loan - other) * 100) / 100;

      return {
        employeeId: record.employee_id,
        employeeNumber: emp?.employee_number ?? "",
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
        grossSalary: gross,
        loanDeduction: loan,
        otherDeduction: other,
        netSalary: net,
        status: net < 0 ? "SHORTFALL" : "OK",
      };
    });

    return rows;
  }

  /**
   * Build a CSV payroll export string for a salary period.
   */
  async exportPayrollCSV(periodId: string): Promise<string> {
    const rows = await this.previewPayroll(periodId);

    const header = "Employee Number,Employee Name,Gross Salary,Loan Deduction,Other Deduction,Net Salary\n";

    const body = rows
      .map(
        (r) =>
          `${r.employeeNumber},${this.csvEscape(r.employeeName)},${r.grossSalary},${r.loanDeduction},${r.otherDeduction},${r.netSalary}`
      )
      .join("\n");

    return header + body;
  }

  async listDeductions(periodId?: string) {
    if (!this.orgId) return [];

    let query = this.supabase
      .from("deduction_records")
      .select(
        `
        *,
        employees:employee_id(employee_number, first_name, last_name),
        salary_periods:salary_period_id(name)
      `
      )
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (periodId) {
      query = query.eq("salary_period_id", periodId);
    }

    const { data } = await query;

    return (data ?? []).map((row) => {
      const emp = row.employees as unknown as
        | { employee_number: string; first_name: string; last_name: string }
        | null;
      const period = row.salary_periods as unknown as { name: string } | null;

      return {
        ...row,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
        employeeNumber: emp?.employee_number ?? "",
        periodName: period?.name ?? "",
      };
    });
  }

  private csvEscape(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}