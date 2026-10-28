import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * Early repayment (spec #53) and restructuring (spec #52).
 *
 * Early settlement charges the outstanding principal plus interest that has
 * already accrued plus any applicable fee. Unearned future interest is waived
 * by default. Restructuring never edits the original schedule: unpaid
 * installments are closed as WAIVED and a new version of the schedule is
 * appended, with the full before/after recorded in the audit trail and a
 * version marker stored on the application.
 */

const SETTLEMENT_MANAGER_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "LOAN_OFFICER",
]);

/** Organization policy: waive unearned interest on early settlement. */
export const WAIVE_FUTURE_INTEREST = true;
/** Organization policy: settlement fee rate applied to outstanding principal. */
export const SETTLEMENT_FEE_RATE = 0;

/**
 * `loan_repayments.payment_method` is constrained to the existing set of
 * methods, so early settlements are recorded as a bank transfer and tagged in
 * the notes instead.
 */
export const EARLY_SETTLEMENT_METHOD = "BANK_TRANSFER";

export type RestructureMode = "EXTEND" | "RESCHEDULE" | "CHANGE_AMOUNT";

export interface SettlementQuote {
  applicationId: string;
  employeeId: string;
  employeeName: string;
  status: string;
  asOf: string;
  outstandingPrincipal: number;
  outstandingInterest: number;
  accruedInterest: number;
  futureInterest: number;
  discount: number;
  fee: number;
  total: number;
  installmentsOutstanding: number;
  paidToDate: number;
  latestRequestAt: string | null;
}

export interface RestructureInput {
  mode: RestructureMode;
  months?: number;
  monthlyAmount?: number;
  startDate?: string;
  note?: string;
}

export interface RestructureHistoryEntry {
  version: number;
  at: string;
  mode: RestructureMode;
  months: number;
  installment: number;
  remainingPrincipal: number;
  remainingInterest: number;
  startDate: string;
  note?: string;
}

type ScheduleRow = {
  id: string;
  month_number: number;
  due_date: string | null;
  status: string;
  opening_balance: number;
  principal_payment: number;
  interest_payment: number;
  total_payment: number;
  closing_balance: number;
  paid_amount: number;
};

type ApplicationRow = {
  id: string;
  employee_id: string;
  organization_id: string;
  amount: number;
  duration_months: number;
  monthly_deduction: number;
  total_interest: number;
  total_repayment: number;
  interest_rate: number;
  interest_method: string;
  status: string;
  notes: string | null;
  employees:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
};

const UNPAID_STATUSES = ["UPCOMING", "DUE", "LATE"];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number) {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const daysInMonth = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
  ).getUTCDate();
  base.setUTCDate(Math.min(day, daysInMonth));
  return base.toISOString().slice(0, 10);
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function employeeNameOf(application: ApplicationRow) {
  const employee = unwrap(application.employees);
  return employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : "Employee";
}

export class LoanSettlementService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;
  private userId: string | null = null;
  private role: string | null = null;
  private employeeId: string | null = null;

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = new LoanSettlementService(supabase);
    if (!user) return service;

    const admin = createAdminClient();
    const [profileResult, employeeResult] = await Promise.all([
      admin
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("employees")
        .select("id, organization_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    service.userId = user.id;
    service.role = profileResult.data?.role ?? null;
    service.employeeId = employeeResult.data?.id ?? null;
    service.orgId =
      profileResult.data?.organization_id ??
      employeeResult.data?.organization_id ??
      null;

    return service;
  }

  canManageSettlements() {
    return Boolean(
      this.orgId && this.role && SETTLEMENT_MANAGER_ROLES.has(this.role)
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

  private async loadApplication(applicationId: string) {
    const { data } = await this.supabase
      .from("loan_applications")
      .select(
        `
        id, employee_id, organization_id, amount, duration_months,
        monthly_deduction, total_interest, total_repayment, interest_rate,
        interest_method, status, notes,
        employees:employee_id(first_name, last_name)
      `
      )
      .eq("id", applicationId)
      .eq("organization_id", this.orgId ?? "")
      .maybeSingle();

    return (data as unknown as ApplicationRow) ?? null;
  }

  private async loadSchedules(applicationId: string, unpaidOnly: boolean) {
    let query = this.supabase
      .from("loan_schedules")
      .select(
        "id, month_number, due_date, status, opening_balance, principal_payment, interest_payment, total_payment, closing_balance, paid_amount"
      )
      .eq("loan_application_id", applicationId)
      .order("month_number", { ascending: true });

    if (unpaidOnly) {
      query = query.in("status", UNPAID_STATUSES);
    }

    const { data } = await query;
    return (data ?? []) as ScheduleRow[];
  }

  /** Only the loan's own employee or a settlement manager may view the quote. */
  private async authorize(application: ApplicationRow, manage: boolean) {
    if (manage) {
      return this.canManageSettlements()
        ? null
        : "Unauthorized: your role cannot settle or restructure loans";
    }

    if (this.employeeId && application.employee_id === this.employeeId) {
      return null;
    }
    if (this.canManageSettlements()) return null;
    return "Unauthorized";
  }

  private async computeQuote(
    application: ApplicationRow,
    schedules: ScheduleRow[],
    asOf: string,
    fee: number
  ): Promise<Omit<SettlementQuote, "latestRequestAt">> {
    let outstandingPrincipal = 0;
    let accruedInterest = 0;
    let futureInterest = 0;
    let paidToDate = 0;
    let installmentsOutstanding = 0;

    for (const schedule of schedules) {
      const total = Number(schedule.total_payment) || 0;
      const paid = Number(schedule.paid_amount) || 0;
      paidToDate += paid;

      if (!UNPAID_STATUSES.includes(schedule.status)) continue;

      const ratio = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 0;
      const unpaidRatio = 1 - ratio;

      const principal = round2(Number(schedule.principal_payment) * unpaidRatio);
      const interest = round2(Number(schedule.interest_payment) * unpaidRatio);
      outstandingPrincipal += principal;

      const due = schedule.due_date?.slice(0, 10);
      if (!due || due <= asOf) {
        accruedInterest += interest;
      } else {
        futureInterest += interest;
      }
      installmentsOutstanding += 1;
    }

    const discount = WAIVE_FUTURE_INTEREST ? futureInterest : 0;
    const policyFee = round2(outstandingPrincipal * SETTLEMENT_FEE_RATE);
    const appliedFee = round2(Math.max(0, fee || policyFee));

    return {
      applicationId: application.id,
      employeeId: application.employee_id,
      employeeName: employeeNameOf(application),
      status: application.status,
      asOf,
      outstandingPrincipal: round2(outstandingPrincipal),
      outstandingInterest: round2(accruedInterest + futureInterest),
      accruedInterest: round2(accruedInterest),
      futureInterest: round2(futureInterest),
      discount: round2(discount),
      fee: appliedFee,
      total: round2(outstandingPrincipal + accruedInterest + appliedFee),
      installmentsOutstanding,
      paidToDate: round2(paidToDate),
    };
  }

  private async latestRequestAt(applicationId: string) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("audit_logs")
      .select("created_at")
      .eq("entity_id", applicationId)
      .eq("action", "loan.early_settlement_requested")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.created_at ?? null;
  }

  async getSettlementQuote(
    applicationId: string,
    options: { asOf?: string; fee?: number } = {}
  ): Promise<{ quote?: SettlementQuote; error?: string }> {
    if (!this.orgId) return { error: "No organization found" };

    const application = await this.loadApplication(applicationId);
    if (!application) return { error: "Loan application not found" };

    const authError = await this.authorize(application, false);
    if (authError) return { error: authError };

    if (!["ACTIVE", "DEFAULTED", "RESTRUCTURED"].includes(application.status)) {
      return { error: `Loan is ${application.status}; no settlement is due` };
    }

    const schedules = await this.loadSchedules(applicationId, false);
    if (schedules.length === 0) return { error: "Loan has no repayment schedule" };

    const quote = await this.computeQuote(
      application,
      schedules,
      options.asOf ?? todayString(),
      options.fee ?? 0
    );

    return {
      quote: { ...quote, latestRequestAt: await this.latestRequestAt(applicationId) },
    };
  }

  /** Employee-initiated request. No money moves until a manager settles it. */
  async requestEarlySettlement(applicationId: string, note?: string) {
    if (!this.userId) return { error: "Unauthorized" };

    const result = await this.getSettlementQuote(applicationId);
    if (!result.quote) return { error: result.error ?? "Could not quote settlement" };

    const quote = result.quote;
    const isOwner = this.employeeId === quote.employeeId;
    if (!isOwner && !this.canManageSettlements()) return { error: "Unauthorized" };

    await this.audit(
      "loan.early_settlement_requested",
      "loan_application",
      applicationId,
      null,
      {
        employeeId: quote.employeeId,
        employeeName: quote.employeeName,
        settlementTotal: quote.total,
        outstandingPrincipal: quote.outstandingPrincipal,
        accruedInterest: quote.accruedInterest,
        discount: quote.discount,
        fee: quote.fee,
        note: note ?? null,
        requestedBy: this.employeeId ? "EMPLOYEE" : "STAFF",
      }
    );

    return {
      success: `Early settlement requested — ${quote.total.toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      })}. Your employer will confirm the payment.`,
      quote,
    };
  }

  /**
   * Record the settlement payment, close the outstanding installments and post
   * the accounting entries. The original schedule rows are retained (WAIVED).
   */
  async settleEarly(
    applicationId: string,
    options: { asOf?: string; fee?: number; note?: string } = {}
  ) {
    if (!this.canManageSettlements() || !this.userId) return { error: "Unauthorized" };

    const application = await this.loadApplication(applicationId);
    if (!application) return { error: "Loan application not found" };
    if (!["ACTIVE", "DEFAULTED", "RESTRUCTURED"].includes(application.status)) {
      return { error: `Loan is ${application.status}; it cannot be settled` };
    }

    const schedules = await this.loadSchedules(applicationId, true);
    if (schedules.length === 0) return { error: "Loan has no outstanding installments" };

    const asOf = options.asOf ?? todayString();
    const quote = await this.computeQuote(application, schedules, asOf, options.fee ?? 0);
    if (quote.total <= 0) return { error: "Settlement amount is zero" };

    // Post the ledger entry first; nothing is mutated if it is rejected.
    const ledger = await LedgerService.create();
    const ledgerResult = await ledger.postLoanRepayment(
      application.employee_id,
      applicationId,
      quote.total,
      quote.outstandingPrincipal,
      round2(quote.accruedInterest + quote.fee)
    );

    if (ledgerResult.error) {
      return { error: `Settlement ledger error: ${ledgerResult.error}` };
    }

    const reference = `SET-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    const settledAt = new Date().toISOString();

    const { error: repaymentError } = await this.supabase
      .from("loan_repayments")
      .insert({
        id: crypto.randomUUID(),
        loan_application_id: applicationId,
        schedule_id: null,
        amount: quote.total,
        payment_method: EARLY_SETTLEMENT_METHOD,
        reference_number: reference,
        recorded_by: this.userId,
        recorded_at: settledAt,
        created_at: settledAt,
        notes: [
          `Early settlement as of ${asOf}`,
          `principal ${quote.outstandingPrincipal}`,
          `accrued interest ${quote.accruedInterest}`,
          `fee ${quote.fee}`,
          options.note ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
      });

    if (repaymentError) {
      if (ledgerResult.id) {
        await ledger.reverseTransaction(
          ledgerResult.id,
          "Early settlement record could not be saved"
        );
      }
      return { error: repaymentError.message };
    }

    const scheduleIds = schedules.map((schedule) => schedule.id);
    const { error: scheduleError } = await this.supabase
      .from("loan_schedules")
      .update({ status: "WAIVED", paid_at: settledAt })
      .in("id", scheduleIds);

    if (scheduleError) return { error: scheduleError.message };

    await this.supabase
      .from("loan_applications")
      .update({ status: "COMPLETED" })
      .eq("id", applicationId)
      .eq("organization_id", this.orgId!);

    const fund = await (await import("./fund-service")).FundService.create();
    const fundAccounts = await fund.listFundAccounts();
    const primaryFund = fundAccounts.find((account) => account.status === "ACTIVE");
    if (primaryFund) {
      await fund.recordMovement(
        primaryFund.id,
        "REPAYMENT",
        quote.total,
        "IN",
        `Early settlement ${reference}`,
        applicationId
      );
    }

    await this.audit(
      "loan.settled_early",
      "loan_application",
      applicationId,
      { status: application.status, paidToDate: quote.paidToDate },
      {
        status: "COMPLETED",
        settlementTotal: quote.total,
        outstandingPrincipal: quote.outstandingPrincipal,
        accruedInterest: quote.accruedInterest,
        futureInterestWaived: quote.discount,
        fee: quote.fee,
        reference,
        closedScheduleIds: scheduleIds,
        note: options.note ?? null,
      }
    );

    return {
      success: `Loan settled early for ${quote.total.toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      })}`,
      quote,
      reference,
    };
  }

  /**
   * Replace the remaining plan with a new schedule version. Original
   * installments are never edited; they are closed as WAIVED and retained.
   */
  async restructureLoan(applicationId: string, input: RestructureInput) {
    if (!this.canManageSettlements() || !this.userId) return { error: "Unauthorized" };

    const application = await this.loadApplication(applicationId);
    if (!application) return { error: "Loan application not found" };
    if (!["ACTIVE", "DEFAULTED", "RESTRUCTURED"].includes(application.status)) {
      return { error: `Loan is ${application.status}; it cannot be restructured` };
    }

    const unpaid = await this.loadSchedules(applicationId, true);
    if (unpaid.length === 0) return { error: "Loan has no outstanding installments" };

    const quote = await this.computeQuote(application, unpaid, todayString(), 0);
    const remainingPrincipal = quote.outstandingPrincipal;
    const remainingInterest = round2(
      quote.outstandingInterest
    );
    const remainingTotal = round2(remainingPrincipal + remainingInterest);

    if (remainingTotal <= 0) return { error: "There is no outstanding balance" };

    let months = Math.trunc(input.months ?? 0);
    if (input.mode === "CHANGE_AMOUNT") {
      const monthly = Number(input.monthlyAmount);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        return { error: "Enter a repayment amount greater than 0" };
      }
      months = Math.min(60, Math.max(1, Math.ceil(remainingTotal / monthly)));
    }

    if (!Number.isFinite(months) || months < 1 || months > 60) {
      return { error: "Repayment period must be between 1 and 60 months" };
    }

    const startDate = input.startDate || addMonths(todayString(), 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { error: "Start date must be a valid date" };
    }

    // Split principal and interest so the final installment absorbs rounding.
    const principalRows: number[] = [];
    const interestRows: number[] = [];
    let principalLeft = remainingPrincipal;
    let interestLeft = remainingInterest;
    for (let i = 0; i < months; i += 1) {
      const principal =
        i === months - 1 ? principalLeft : round2(remainingPrincipal / months);
      const interest =
        i === months - 1 ? interestLeft : round2(remainingInterest / months);
      principalRows.push(round2(principal));
      interestRows.push(round2(interest));
      principalLeft = round2(principalLeft - principal);
      interestLeft = round2(interestLeft - interest);
    }

    const maxMonth = (
      await this.loadSchedules(applicationId, false)
    ).reduce((max, row) => Math.max(max, row.month_number), 0);

    let opening = remainingPrincipal;
    const today = todayString();
    const inserts = principalRows.map((principal, index) => {
      const interest = interestRows[index];
      const total = round2(principal + interest);
      const closing = round2(Math.max(0, opening - principal));
      const dueDate = addMonths(startDate, index);
      const row = {
        id: crypto.randomUUID(),
        loan_application_id: applicationId,
        month_number: maxMonth + index + 1,
        opening_balance: opening,
        principal_payment: principal,
        interest_payment: interest,
        total_payment: total,
        closing_balance: closing,
        status: dueDate <= today ? "DUE" : "UPCOMING",
        due_date: dueDate,
        paid_amount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      opening = closing;
      return row;
    });

    const { data: inserted, error: insertError } = await this.supabase
      .from("loan_schedules")
      .insert(inserts)
      .select("id, month_number, due_date, total_payment");

    if (insertError) return { error: insertError.message };

    const { error: closeError } = await this.supabase
      .from("loan_schedules")
      .update({ status: "WAIVED" })
      .in("id", unpaid.map((row) => row.id));

    if (closeError) {
      // Roll back the freshly inserted version if the old one could not close.
      await this.supabase
        .from("loan_schedules")
        .delete()
        .in("id", (inserted ?? []).map((row) => row.id));
      return { error: closeError.message };
    }

    const newPaidToDate = round2(quote.paidToDate);
    const newTotalRepayment = round2(newPaidToDate + remainingTotal);
    const newMonthly = round2(remainingTotal / months);
    const newTotalInterest = round2(Math.max(0, newTotalRepayment - application.amount));

    const history = this.parseHistory(application.notes);
    const version = history.length + 1;
    const entry: RestructureHistoryEntry = {
      version,
      at: new Date().toISOString(),
      mode: input.mode,
      months,
      installment: newMonthly,
      remainingPrincipal,
      remainingInterest,
      startDate,
      note: input.note?.trim() || undefined,
    };
    const marker = `[[RESTRUCTURE]]${JSON.stringify(entry)}`;
    const notes = application.notes ? `${application.notes}\n${marker}` : marker;

    const { error: updateError } = await this.supabase
      .from("loan_applications")
      .update({
        status: "ACTIVE",
        duration_months: months,
        monthly_deduction: newMonthly,
        total_repayment: newTotalRepayment,
        total_interest: newTotalInterest,
        notes,
      })
      .eq("id", applicationId)
      .eq("organization_id", this.orgId!);

    if (updateError) return { error: updateError.message };

    await this.audit(
      "loan.restructured",
      "loan_application",
      applicationId,
      {
        status: application.status,
        durationMonths: application.duration_months,
        monthlyDeduction: Number(application.monthly_deduction),
        unpaidSchedules: unpaid.map((row) => ({
          id: row.id,
          month: row.month_number,
          dueDate: row.due_date,
          total: Number(row.total_payment),
          paid: Number(row.paid_amount),
          status: row.status,
        })),
      },
      {
        version,
        mode: input.mode,
        months,
        installment: newMonthly,
        startDate,
        remainingPrincipal,
        remainingInterest,
        newSchedules: inserted ?? [],
        note: input.note ?? null,
      }
    );

    return {
      success: `Loan restructured — ${months} installment${
        months === 1 ? "" : "s"
      } of ${newMonthly.toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      })} from ${startDate}.`,
      version,
      months,
      installment: newMonthly,
    };
  }

  parseHistory(notes: string | null): RestructureHistoryEntry[] {
    if (!notes) return [];
    const entries: RestructureHistoryEntry[] = [];
    for (const line of notes.split("\n")) {
      const marker = "[[RESTRUCTURE]]";
      if (!line.startsWith(marker)) continue;
      try {
        entries.push(JSON.parse(line.slice(marker.length)) as RestructureHistoryEntry);
      } catch {
        // Ignore malformed markers rather than breaking the loan view.
      }
    }
    return entries;
  }

  async getRestructureHistory(applicationId: string) {
    const application = await this.loadApplication(applicationId);
    if (!application) return [];
    return this.parseHistory(application.notes);
  }
}
