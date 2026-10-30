import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * Applies the loan portion of a salary run to the employee's active loans.
 *
 * Payroll credits the net salary (already reduced by the loan deduction) to the
 * wallet, but the loan itself must also be updated: schedule entries marked
 * paid and a repayment posted to the ledger. This service does that allocation
 * in schedule order and is idempotent per salary period.
 */

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export class RepaymentService {
  /**
   * Apply every employee's loan deduction for a salary period. Safe to call
   * again: employees that already have processed deduction records for the
   * period are skipped.
   */
  static async applyPeriodLoanDeductions(
    organizationId: string,
    periodId: string,
    actorUserId: string | null
  ) {
    const admin = createAdminClient();

    const { data: records } = await admin
      .from("salary_records")
      .select("employee_id, loan_deductions")
      .eq("organization_id", organizationId)
      .eq("salary_period_id", periodId);

    if (!records?.length) {
      return { ok: true, applied: 0, total: 0, skipped: 0 };
    }

    // Deduplicate by employee in case the import created repeated rows.
    const byEmployee = new Map<string, number>();
    for (const record of records) {
      if (byEmployee.has(record.employee_id)) continue;
      byEmployee.set(record.employee_id, Number(record.loan_deductions) || 0);
    }

    const ledger = LedgerService.createForOrganization(
      organizationId,
      actorUserId
    );

    let applied = 0;
    let skipped = 0;
    let totalApplied = 0;

    for (const [employeeId, amount] of byEmployee) {
      if (amount <= 0) continue;

      // Already processed for this period?
      const { data: existing } = await admin
        .from("deduction_records")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("salary_period_id", periodId)
        .eq("employee_id", employeeId)
        .eq("status", "PROCESSED")
        .limit(1);

      if (existing?.length) {
        skipped += 1;
        continue;
      }

      const { data: loans } = await admin
        .from("loan_applications")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId)
        .in("status", ["ACTIVE", "DISBURSED"])
        .order("created_at", { ascending: true });

      let remaining = amount;

      for (const loan of loans ?? []) {
        if (remaining <= 0) break;

        // One instalment per loan per salary period: the earliest unpaid one.
        const { data: schedule } = await admin
          .from("loan_schedules")
          .select("id, total_payment, paid_amount, interest_payment, status, month_number")
          .eq("loan_application_id", loan.id)
          .in("status", ["UPCOMING", "DUE", "LATE", "PARTIAL"])
          .order("month_number", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!schedule) continue;

        const due = Number(schedule.total_payment) - Number(schedule.paid_amount);
        if (due <= 0.005) continue;

        const portion = round2(Math.min(remaining, due));
        const newPaid = round2(Number(schedule.paid_amount) + portion);
        const fullyPaid = newPaid >= Number(schedule.total_payment) - 0.005;

        await admin
          .from("loan_schedules")
          .update({
            paid_amount: newPaid,
            status: fullyPaid ? "PAID" : "LATE",
            paid_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        const interestPortion = Math.min(
          Number(schedule.interest_payment) || 0,
          portion
        );
        const principalPortion = round2(portion - interestPortion);

        await ledger.postLoanRepayment(
          employeeId,
          loan.id,
          portion,
          principalPortion,
          interestPortion
        );

        // Mirror the movement on the deductions page and the statement. One
        // record per loan per period (unique on period + employee + loan).
        await admin.from("deduction_records").upsert(
          {
            organization_id: organizationId,
            salary_period_id: periodId,
            employee_id: employeeId,
            loan_application_id: loan.id,
            schedule_id: schedule.id,
            deduction_type: "LOAN",
            expected_amount: round2(due),
            actual_amount: portion,
            shortfall: round2(Math.max(0, due - portion)),
            remaining_balance: round2(Number(schedule.total_payment) - newPaid),
            reference: `SLF-DED-${periodId.slice(0, 8)}-${employeeId.slice(0, 8)}-${schedule.month_number}`,
            status: fullyPaid ? "PROCESSED" : "PARTIAL",
            processed_at: new Date().toISOString(),
          },
          {
            onConflict: "salary_period_id,employee_id,loan_application_id",
            ignoreDuplicates: false,
          }
        );

        remaining = round2(remaining - portion);
        applied += 1;
        totalApplied = round2(totalApplied + portion);
      }

        // Complete the loan once every schedule is settled.
        const { data: allSchedules } = await admin
          .from("loan_schedules")
          .select("status")
          .eq("loan_application_id", loan.id);

        if (
          allSchedules?.length &&
          allSchedules.every(
            (s) => s.status === "PAID" || s.status === "WAIVED"
          )
        ) {
          await admin
            .from("loan_applications")
            .update({ status: "COMPLETED" })
            .eq("id", loan.id)
            .eq("organization_id", organizationId);
        }
      }
    }

    if (applied > 0) {
      await recordAudit({
        organizationId,
        userId: actorUserId,
        action: "payroll.loan_deductions_applied",
        entityType: "salary_period",
        entityId: periodId,
        after: { applied, total: totalApplied, skipped },
      });
    }

    return {
      ok: true,
      applied,
      total: totalApplied,
      skipped,
    };
  }
}
