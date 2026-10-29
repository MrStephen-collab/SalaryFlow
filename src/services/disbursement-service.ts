import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * Salary disbursement.
 *
 * A run takes a salary period's records and credits each employee's wallet
 * from the organization's funded salary pool. Runs are idempotent: every
 * employee credit is guarded by its run item and a deterministic ledger
 * reference, so a retried run can never pay someone twice.
 *
 * The pool is checked before anything is paid. If it cannot cover the run the
 * whole run is refused instead of paying some employees and not others.
 */

export const DISBURSEMENT_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "PAYROLL_OFFICER",
  "ACCOUNTANT",
]);

type Admin = ReturnType<typeof createAdminClient>;

export interface DisbursementResult {
  ok: boolean;
  runId?: string;
  status?: string;
  processed?: number;
  failed?: number;
  total?: number;
  error?: string;
  message?: string;
}

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export class DisbursementService {
  /** Runs for the signed-in user's organization. */
  static async listRuns(limit = 20) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) return [];

    const { data } = await supabase
      .from("salary_disbursement_runs")
      .select(
        "id, salary_period_id, scheduled_for, status, total_amount, employee_count, processed_count, failed_count, trigger_source, failure_reason, started_at, completed_at, created_at"
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    return data ?? [];
  }

  static async getRunForPeriod(periodId: string) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("salary_disbursement_runs")
      .select("*")
      .eq("salary_period_id", periodId)
      .maybeSingle();

    return data ?? null;
  }

  static async getRunItems(runId: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("salary_disbursement_items")
      .select(
        "id, employee_id, amount, status, ledger_reference, error, employees(first_name, last_name, employee_number)"
      )
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    return data ?? [];
  }

  /** Pay a salary period immediately (manual "Pay now" from the dashboard). */
  static async payPeriodNow(periodId: string): Promise<DisbursementResult> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to continue" };

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return { ok: false, error: "No organization is linked to this account" };
    }
    if (!DISBURSEMENT_ROLES.has(profile.role)) {
      return { ok: false, error: "You do not have permission to run payroll" };
    }

    const { data: period } = await supabase
      .from("salary_periods")
      .select("id, organization_id")
      .eq("id", periodId)
      .maybeSingle();

    if (!period || period.organization_id !== profile.organization_id) {
      return { ok: false, error: "Salary period not found" };
    }

    return this.processPeriod(profile.organization_id, periodId, user.id, "MANUAL");
  }

  /**
   * Create (if needed) and process a run for one period. Safe to call from a
   * web request or the daily cron job.
   */
  static async processPeriod(
    organizationId: string,
    periodId: string,
    actorUserId: string | null,
    source: "SCHEDULED" | "MANUAL"
  ): Promise<DisbursementResult> {
    const admin = createAdminClient();

    const { data: period } = await admin
      .from("salary_periods")
      .select("id, name, payment_date, status")
      .eq("id", periodId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!period) return { ok: false, error: "Salary period not found" };

    const { data: records } = await admin
      .from("salary_records")
      .select("id, employee_id, net_salary, status")
      .eq("salary_period_id", periodId)
      .order("created_at", { ascending: true });

    if (!records?.length) {
      return { ok: false, error: "This period has no salary records to pay" };
    }

    // One credit per employee even if the import produced duplicate rows.
    const byEmployee = new Map<
      string,
      { employeeId: string; amount: number; recordId: string }
    >();
    for (const record of records) {
      if (byEmployee.has(record.employee_id)) continue;
      byEmployee.set(record.employee_id, {
        employeeId: record.employee_id,
        amount: Number(record.net_salary) || 0,
        recordId: record.id,
      });
    }

    const payables = [...byEmployee.values()].filter((r) => r.amount > 0);
    const total = round2(payables.reduce((sum, r) => sum + r.amount, 0));

    if (total <= 0) {
      return { ok: false, error: "There is nothing to pay in this period" };
    }

    let { data: run } = await admin
      .from("salary_disbursement_runs")
      .select("*")
      .eq("salary_period_id", periodId)
      .maybeSingle();

    if (run?.status === "COMPLETED") {
      return {
        ok: true,
        runId: run.id,
        status: "COMPLETED",
        processed: run.processed_count,
        failed: run.failed_count,
        total: Number(run.total_amount),
        message: "This period has already been paid",
      };
    }

    if (!run) {
      const { data: created, error } = await admin
        .from("salary_disbursement_runs")
        .insert({
          organization_id: organizationId,
          salary_period_id: periodId,
          scheduled_for: period.payment_date ?? new Date().toISOString().slice(0, 10),
          status: "SCHEDULED",
          total_amount: total,
          employee_count: payables.length,
          trigger_source: source,
          triggered_by: actorUserId,
        })
        .select("*")
        .single();

      if (error) return { ok: false, error: error.message };
      run = created;
    }

    // Claim the run so two callers cannot pay the same period at once.
    const { data: claimed } = await admin
      .from("salary_disbursement_runs")
      .update({
        status: "PROCESSING",
        started_at: new Date().toISOString(),
        failure_reason: null,
        total_amount: total,
        employee_count: payables.length,
      })
      .eq("id", run.id)
      .in("status", ["SCHEDULED", "FAILED", "PARTIAL"])
      .select("*")
      .maybeSingle();

    if (!claimed) {
      return {
        ok: false,
        error: "This payroll run is already processing or has been completed",
      };
    }

    const poolBalance = await this.poolBalance(admin, organizationId);
    if (poolBalance < total) {
      const shortfall = round2(total - poolBalance);
      await admin
        .from("salary_disbursement_runs")
        .update({
          status: "FAILED",
          failure_reason: `Insufficient salary pool. Available ${naira(poolBalance)}, required ${naira(total)}. Top up ${naira(shortfall)} to pay this run.`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      await recordAudit({
        organizationId,
        userId: actorUserId,
        action: "salary.disbursement_failed",
        entityType: "salary_disbursement_run",
        entityId: run.id,
        after: { reason: "INSUFFICIENT_POOL", poolBalance, total },
      });

      return {
        ok: false,
        runId: run.id,
        status: "FAILED",
        error: `Salary pool is short by ${naira(shortfall)}. Fund the pool and try again.`,
      };
    }

    const { data: existingItems } = await admin
      .from("salary_disbursement_items")
      .select("employee_id, status")
      .eq("run_id", run.id);

    const itemStatus = new Map(
      (existingItems ?? []).map((item) => [item.employee_id, item.status])
    );

    const ledger = LedgerService.createForOrganization(organizationId, actorUserId);

    let processed = 0;
    let failed = 0;

    for (const payable of payables) {
      if (itemStatus.get(payable.employeeId) === "CREDITED") {
        processed += 1;
        continue;
      }

      const ledgerReference = `SLF-SAL-${run.id.slice(0, 8)}-${payable.employeeId.slice(0, 8)}`;

      // A previous attempt may have posted to the ledger and crashed before
      // recording the item. The deterministic reference makes that detectable.
      const { data: alreadyPosted } = await admin
        .from("ledger_transactions")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("reference", ledgerReference)
        .maybeSingle();

      if (!alreadyPosted) {
        const posted = await ledger.postSalaryDisbursement(
          payable.employeeId,
          run.id,
          payable.amount
        );

        if (posted.error) {
          failed += 1;
          await admin.from("salary_disbursement_items").upsert(
            {
              organization_id: organizationId,
              run_id: run.id,
              employee_id: payable.employeeId,
              salary_record_id: payable.recordId,
              amount: payable.amount,
              status: "FAILED",
              error: posted.error,
            },
            { onConflict: "run_id,employee_id" }
          );
          continue;
        }
      }

      processed += 1;
      await admin.from("salary_disbursement_items").upsert(
        {
          organization_id: organizationId,
          run_id: run.id,
          employee_id: payable.employeeId,
          salary_record_id: payable.recordId,
          amount: payable.amount,
          status: "CREDITED",
          ledger_reference: ledgerReference,
          error: null,
        },
        { onConflict: "run_id,employee_id" }
      );
    }

    const status =
      failed === 0 ? "COMPLETED" : processed > 0 ? "PARTIAL" : "FAILED";

    await admin
      .from("salary_disbursement_runs")
      .update({
        status,
        processed_count: processed,
        failed_count: failed,
        completed_at: new Date().toISOString(),
        failure_reason:
          failed > 0 ? `${failed} employee payment(s) failed - see the run items` : null,
      })
      .eq("id", run.id);

    if (status === "COMPLETED") {
      await admin
        .from("salary_periods")
        .update({ status: "PAID" })
        .eq("id", periodId)
        .eq("organization_id", organizationId);
    }

    await recordAudit({
      organizationId,
      userId: actorUserId,
      action: "salary.disbursed",
      entityType: "salary_disbursement_run",
      entityId: run.id,
      after: { status, processed, failed, total, source },
    });

    return {
      ok: status !== "FAILED",
      runId: run.id,
      status,
      processed,
      failed,
      total,
      message:
        status === "COMPLETED"
          ? `Paid ${processed} employee(s), ${naira(total)} credited to wallets`
          : `${processed} paid, ${failed} failed. Review the run and retry the failed items.`,
    };
  }

  /**
   * Daily sweep used by the cron endpoint: pays every period whose payment
   * date has arrived for organizations that enabled automatic disbursement.
   */
  static async runDue() {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: settings, error: settingsError } = await admin
      .from("organization_settings")
      .select("organization_id, auto_disburse_salaries")
      .eq("auto_disburse_salaries", true);

    if (settingsError) {
      return { ok: false, error: settingsError.message, results: [] as DisbursementResult[] };
    }

    const results: Array<DisbursementResult & { organizationId?: string; period?: string }> = [];

    for (const setting of settings ?? []) {
      const { data: periods } = await admin
        .from("salary_periods")
        .select("id, name, payment_date, status")
        .eq("organization_id", setting.organization_id)
        .lte("payment_date", today)
        .neq("status", "PAID");

      for (const period of periods ?? []) {
        const { data: existingRun } = await admin
          .from("salary_disbursement_runs")
          .select("id, status")
          .eq("salary_period_id", period.id)
          .maybeSingle();

        if (existingRun?.status === "COMPLETED") continue;
        if (existingRun?.status === "PROCESSING") continue;

        const result = await this.processPeriod(
          setting.organization_id,
          period.id,
          null,
          "SCHEDULED"
        );
        results.push({ ...result, organizationId: setting.organization_id, period: period.name });
      }
    }

    return { ok: true, results };
  }

  private static async poolBalance(admin: Admin, organizationId: string) {
    const { data: accounts } = await admin
      .from("fund_accounts")
      .select("id, opening_balance")
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE");

    if (!accounts?.length) return 0;

    let balance = accounts.reduce(
      (sum, account) => sum + (Number(account.opening_balance) || 0),
      0
    );

    const { data: movements } = await admin
      .from("fund_transactions")
      .select("amount, direction")
      .eq("organization_id", organizationId)
      .in(
        "fund_account_id",
        accounts.map((account) => account.id)
      );

    for (const movement of movements ?? []) {
      const amount = Number(movement.amount) || 0;
      balance += movement.direction === "IN" ? amount : -amount;
    }

    return round2(balance);
  }
}
