import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * In-app notifications (spec #55).
 *
 * The platform has no notifications table yet, so notifications are derived
 * from the financial records that already exist. This keeps the feature
 * deployable without a migration while still giving users an accurate,
 * real-time feed. Read state is stored client-side per notification id.
 */

export type NotificationTone = "info" | "success" | "warning" | "danger";

export type NotificationCategory =
  | "loan"
  | "withdrawal"
  | "payroll"
  | "deduction"
  | "approval"
  | "system";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  tone: NotificationTone;
  category: NotificationCategory;
  amount?: number;
  reference?: string;
}

type Embedded<T> = T | T[] | null;

function unwrap<T>(value: Embedded<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function timestamp(...values: (string | null | undefined)[]) {
  for (const value of values) {
    if (value) return value;
  }
  return new Date(0).toISOString();
}

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

export class NotificationService {
  private orgId: string | null = null;
  private employeeId: string | null = null;
  private role: string | null = null;
  private isSuperAdmin = false;

  private constructor() {}

  static async create() {
    const service = new NotificationService();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    service.role = profileResult.data?.role ?? null;
    service.isSuperAdmin = service.role === "SUPER_ADMIN";
    service.employeeId = employeeResult.data?.id ?? null;
    service.orgId =
      employeeResult.data?.organization_id ??
      profileResult.data?.organization_id ??
      null;

    return service;
  }

  getRole() {
    return this.role;
  }

  async list(limit = 12): Promise<NotificationItem[]> {
    if (this.isSuperAdmin) return this.platformNotifications(limit);
    if (this.employeeId && this.role === "EMPLOYEE") {
      return this.employeeNotifications(limit);
    }
    if (this.orgId) return this.staffNotifications(limit);
    return [];
  }

  private async employeeNotifications(limit: number) {
    if (!this.orgId || !this.employeeId) return [];
    const admin = createAdminClient();
    const items: NotificationItem[] = [];

    const [loans, withdrawals, deductions, schedules] = await Promise.all([
      admin
        .from("loan_applications")
        .select(
          `
          id, status, amount, created_at, updated_at, approved_at, rejected_at,
          rejection_reason,
          loan_products:loan_product_id(name)
        `
        )
        .eq("employee_id", this.employeeId)
        .in("status", ["APPROVED", "REJECTED", "ACTIVE", "DISBURSED", "COMPLETED"])
        .order("updated_at", { ascending: false })
        .limit(20),
      admin
        .from("withdrawal_requests")
        .select(
          "id, status, amount, reference, created_at, updated_at, paid_at, processed_at, approved_at, failure_reason"
        )
        .eq("employee_id", this.employeeId)
        .in("status", ["APPROVED", "PROCESSING", "PAID", "REJECTED", "FAILED"])
        .order("updated_at", { ascending: false })
        .limit(20),
      admin
        .from("deduction_records")
        .select(
          `
          id, status, expected_amount, actual_amount, shortfall, processed_at,
          created_at, reference,
          salary_periods:salary_period_id(name)
        `
        )
        .eq("employee_id", this.employeeId)
        .in("status", ["PROCESSED", "PARTIAL", "FAILED"])
        .order("processed_at", { ascending: false })
        .limit(20),
      admin
        .from("loan_schedules")
        .select(
          `
          id, status, due_date, total_payment, paid_amount,
          loan_applications!inner(id, employee_id, status)
        `
        )
        .eq("loan_applications.employee_id", this.employeeId)
        .in("loan_applications.status", ["ACTIVE", "DEFAULTED"])
        .in("status", ["DUE", "LATE", "UPCOMING"])
        .lte("due_date", daysFromNow(7))
        .order("due_date", { ascending: true })
        .limit(10),
    ]);

    for (const loan of loans.data ?? []) {
      const product = unwrap(
        loan.loan_products as unknown as Embedded<{ name: string | null }>
      );
      const label = product?.name ? ` — ${product.name}` : "";
      const amount = naira(Number(loan.amount) || 0);

      switch (loan.status) {
        case "APPROVED":
          items.push({
            id: `loan-approved-${loan.id}`,
            title: "Loan approved",
            description: `Your ${amount} loan${label} was approved and is awaiting disbursement.`,
            href: `/employee/loans/${loan.id}`,
            createdAt: timestamp(loan.approved_at, loan.updated_at, loan.created_at),
            tone: "success",
            category: "loan",
            amount: Number(loan.amount) || 0,
          });
          break;
        case "REJECTED":
          items.push({
            id: `loan-rejected-${loan.id}`,
            title: "Loan application declined",
            description:
              loan.rejection_reason ||
              `Your ${amount} loan application${label} was declined.`,
            href: `/employee/loans/${loan.id}`,
            createdAt: timestamp(loan.rejected_at, loan.updated_at, loan.created_at),
            tone: "danger",
            category: "loan",
            amount: Number(loan.amount) || 0,
          });
          break;
        case "ACTIVE":
        case "DISBURSED":
          items.push({
            id: `loan-disbursed-${loan.id}`,
            title: "Loan disbursed",
            description: `Your ${amount} loan${label} has been disbursed. Repayments are now scheduled.`,
            href: `/employee/loans/${loan.id}`,
            createdAt: timestamp(loan.approved_at, loan.updated_at, loan.created_at),
            tone: "info",
            category: "loan",
            amount: Number(loan.amount) || 0,
          });
          break;
        case "COMPLETED":
          items.push({
            id: `loan-completed-${loan.id}`,
            title: "Loan completed",
            description: `You have fully repaid your ${amount} loan${label}.`,
            href: `/employee/loans/${loan.id}`,
            createdAt: timestamp(loan.updated_at, loan.created_at),
            tone: "success",
            category: "loan",
            amount: Number(loan.amount) || 0,
          });
          break;
      }
    }

    for (const withdrawal of withdrawals.data ?? []) {
      const amount = naira(Number(withdrawal.amount) || 0);
      const map: Record<string, { title: string; tone: NotificationTone }> = {
        APPROVED: { title: "Withdrawal approved", tone: "info" },
        PROCESSING: { title: "Withdrawal processing", tone: "info" },
        PAID: { title: "Withdrawal paid", tone: "success" },
        REJECTED: { title: "Withdrawal rejected", tone: "danger" },
        FAILED: { title: "Withdrawal failed", tone: "danger" },
      };
      const entry = map[withdrawal.status];
      if (!entry) continue;

      items.push({
        id: `withdrawal-${withdrawal.status.toLowerCase()}-${withdrawal.id}`,
        title: entry.title,
        description:
          withdrawal.failure_reason ||
          `${amount} to your bank account${withdrawal.reference ? ` · ${withdrawal.reference}` : ""}.`,
        href: "/employee/withdrawals",
        createdAt: timestamp(
          withdrawal.paid_at,
          withdrawal.processed_at,
          withdrawal.approved_at,
          withdrawal.updated_at,
          withdrawal.created_at
        ),
        tone: entry.tone,
        category: "withdrawal",
        amount: Number(withdrawal.amount) || 0,
        reference: withdrawal.reference ?? undefined,
      });
    }

    for (const deduction of deductions.data ?? []) {
      const period = unwrap(
        deduction.salary_periods as unknown as Embedded<{ name: string | null }>
      );
      const actual = Number(deduction.actual_amount) || 0;
      if (deduction.status === "PROCESSED") {
        items.push({
          id: `deduction-processed-${deduction.id}`,
          title: "Salary deduction processed",
          description: `${naira(actual)} was deducted${period?.name ? ` from ${period.name}` : ""} towards your loan.`,
          href: `/receipts/deduction/${deduction.id}`,
          createdAt: timestamp(deduction.processed_at, deduction.created_at),
          tone: "info",
          category: "deduction",
          amount: actual,
          reference: deduction.reference ?? undefined,
        });
      } else {
        const shortfall = Number(deduction.shortfall) || 0;
        items.push({
          id: `deduction-short-${deduction.id}`,
          title:
            deduction.status === "FAILED"
              ? "Salary deduction failed"
              : "Partial salary deduction",
          description: `${naira(actual)} of ${naira(Number(deduction.expected_amount) || 0)} was deducted${
            shortfall > 0 ? ` · shortfall ${naira(shortfall)}` : ""
          }.`,
          href: "/employee/statement",
          createdAt: timestamp(deduction.processed_at, deduction.created_at),
          tone: "warning",
          category: "deduction",
          amount: actual,
          reference: deduction.reference ?? undefined,
        });
      }
    }

    for (const schedule of schedules.data ?? []) {
      const loan = unwrap(
        schedule.loan_applications as unknown as Embedded<{
          id: string;
          status: string;
        }>
      );
      const outstanding = Math.max(
        0,
        Number(schedule.total_payment) - Number(schedule.paid_amount ?? 0)
      );
      if (outstanding <= 0) continue;

      const due = schedule.due_date
        ? new Date(schedule.due_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "the due date";
      const daysOverdue = schedule.due_date
        ? Math.max(
            0,
            Math.floor(
              (Date.now() -
                new Date(`${schedule.due_date.slice(0, 10)}T00:00:00.000Z`).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : 0;

      items.push({
        id: `my-schedule-${schedule.status.toLowerCase()}-${schedule.id}`,
        title:
          schedule.status === "LATE"
            ? daysOverdue >= 90
              ? "Loan seriously overdue"
              : "Payment overdue"
            : schedule.status === "DUE"
              ? "Payment due"
              : "Loan approaching due date",
        description:
          schedule.status === "LATE"
            ? `${naira(outstanding)} was due on ${due} — ${daysOverdue} day${
                daysOverdue === 1 ? "" : "s"
              } overdue.`
            : `${naira(outstanding)} is due on ${due}.`,
        href: loan ? `/employee/loans/${loan.id}` : "/employee/loans",
        createdAt: timestamp(schedule.due_date),
        tone: schedule.status === "DUE" || schedule.status === "LATE" ? "danger" : "info",
        category: "loan",
        amount: outstanding,
      });
    }

    return this.finish(items, limit);
  }

  private async staffNotifications(limit: number) {
    if (!this.orgId) return [];
    const admin = createAdminClient();
    const items: NotificationItem[] = [];

    const [applications, withdrawals, shortfalls, schedules, settlementRequests] =
      await Promise.all([
      admin
        .from("loan_applications")
        .select(
          `
          id, status, amount, created_at, submitted_at,
          employees:employee_id(first_name, last_name),
          loan_products:loan_product_id(name)
        `
        )
        .eq("organization_id", this.orgId)
        .in("status", ["SUBMITTED", "UNDER_REVIEW", "READY_FOR_DISBURSEMENT"])
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("withdrawal_requests")
        .select(
          `
          id, status, amount, reference, created_at,
          employees:employee_id(first_name, last_name)
        `
        )
        .eq("organization_id", this.orgId)
        .in("status", ["PENDING", "REVIEW"])
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("deduction_records")
        .select(
          `
          id, status, actual_amount, expected_amount, shortfall, processed_at, created_at,
          employees:employee_id(first_name, last_name)
        `
        )
        .eq("organization_id", this.orgId)
        .in("status", ["PARTIAL", "FAILED"])
        .order("processed_at", { ascending: false })
        .limit(10),
      admin
        .from("loan_schedules")
        .select(
          `
          id, status, due_date, total_payment, paid_amount,
          loan_applications!inner(
            id, organization_id,
            employees:employee_id(first_name, last_name)
          )
        `
        )
        .eq("loan_applications.organization_id", this.orgId)
        .in("status", ["DUE", "LATE", "UPCOMING"])
        .lte("due_date", daysFromNow(7))
        .order("due_date", { ascending: true })
        .limit(10),
      admin
        .from("audit_logs")
        .select("id, entity_id, created_at, after_data")
        .eq("organization_id", this.orgId)
        .eq("action", "loan.early_settlement_requested")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    for (const application of applications.data ?? []) {
      const employee = unwrap(
        application.employees as unknown as Embedded<{
          first_name: string | null;
          last_name: string | null;
        }>
      );
      const product = unwrap(
        application.loan_products as unknown as Embedded<{ name: string | null }>
      );
      const name = employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
        : "An employee";

      items.push({
        id: `approval-loan-${application.id}`,
        title:
          application.status === "READY_FOR_DISBURSEMENT"
            ? "Loan ready for disbursement"
            : "Loan application awaiting review",
        description: `${name} requested ${naira(Number(application.amount) || 0)}${
          product?.name ? ` · ${product.name}` : ""
        }.`,
        href: `/dashboard/loans/applications/${application.id}`,
        createdAt: timestamp(application.submitted_at, application.created_at),
        tone: application.status === "READY_FOR_DISBURSEMENT" ? "success" : "warning",
        category: "approval",
        amount: Number(application.amount) || 0,
      });
    }

    for (const withdrawal of withdrawals.data ?? []) {
      const employee = unwrap(
        withdrawal.employees as unknown as Embedded<{
          first_name: string | null;
          last_name: string | null;
        }>
      );
      const name = employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
        : "An employee";

      items.push({
        id: `approval-withdrawal-${withdrawal.id}`,
        title: "Withdrawal awaiting approval",
        description: `${name} requested ${naira(Number(withdrawal.amount) || 0)}${
          withdrawal.reference ? ` · ${withdrawal.reference}` : ""
        }.`,
        href: `/dashboard/withdrawals/${withdrawal.id}`,
        createdAt: timestamp(withdrawal.created_at),
        tone: "warning",
        category: "approval",
        amount: Number(withdrawal.amount) || 0,
        reference: withdrawal.reference ?? undefined,
      });
    }

    for (const deduction of shortfalls.data ?? []) {
      const employee = unwrap(
        deduction.employees as unknown as Embedded<{
          first_name: string | null;
          last_name: string | null;
        }>
      );
      const name = employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
        : "An employee";

      items.push({
        id: `shortfall-${deduction.id}`,
        title:
          deduction.status === "FAILED"
            ? "Deduction failed"
            : "Deduction shortfall",
        description: `${name}: ${naira(Number(deduction.actual_amount) || 0)} of ${naira(
          Number(deduction.expected_amount) || 0
        )} deducted · shortfall ${naira(Number(deduction.shortfall) || 0)}.`,
        href: "/dashboard/deductions",
        createdAt: timestamp(deduction.processed_at, deduction.created_at),
        tone: "warning",
        category: "deduction",
        amount: Number(deduction.shortfall) || 0,
      });
    }

    for (const schedule of schedules.data ?? []) {
      const application = unwrap(
        schedule.loan_applications as unknown as Embedded<{
          id: string;
          employees: Embedded<{ first_name: string | null; last_name: string | null }>;
        }>
      );
      const employee = unwrap(application?.employees);
      const name = employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
        : "An employee";
      const due = schedule.due_date
        ? new Date(schedule.due_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })
        : "soon";

      const daysOverdue = schedule.due_date
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(`${schedule.due_date.slice(0, 10)}T00:00:00.000Z`).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : 0;

      const outstanding = Math.max(
        0,
        Number(schedule.total_payment) - Number(schedule.paid_amount ?? 0)
      );
      if (outstanding <= 0) continue;

      items.push({
        id: `schedule-${schedule.status.toLowerCase()}-${schedule.id}`,
        title:
          schedule.status === "LATE"
            ? daysOverdue >= 90
              ? "Loan seriously overdue"
              : "Payment overdue"
            : schedule.status === "DUE"
              ? "Repayment due"
              : "Repayment due soon",
        description:
          schedule.status === "LATE"
            ? `${name} owes ${naira(outstanding)}, ${daysOverdue} day${
                daysOverdue === 1 ? "" : "s"
              } past due (since ${due}).`
            : `${name} owes ${naira(outstanding)} by ${due}.`,
        href: application ? `/dashboard/loans/applications/${application.id}` : "/dashboard/loans",
        createdAt: timestamp(schedule.due_date),
        tone: schedule.status === "DUE" || schedule.status === "LATE" ? "danger" : "info",
        category: "loan",
        amount: outstanding,
      });
    }

    const seenSettlementLoans = new Set<string>();
    for (const request of settlementRequests.data ?? []) {
      if (!request.entity_id || seenSettlementLoans.has(request.entity_id)) {
        continue;
      }
      seenSettlementLoans.add(request.entity_id);

      const after = request.after_data as Record<string, unknown> | null;
      const name =
        typeof after?.employeeName === "string" && after.employeeName
          ? after.employeeName
          : "An employee";
      const amount = Number(after?.settlementTotal) || 0;

      items.push({
        id: `settlement-request-${request.entity_id}`,
        title: "Early settlement requested",
        description: `${name} asked to settle their loan early for ${naira(amount)}.`,
        href: `/dashboard/loans/applications/${request.entity_id}`,
        createdAt: timestamp(request.created_at),
        tone: "warning",
        category: "approval",
        amount,
      });
    }

    return this.finish(items, limit);
  }

  private async platformNotifications(limit: number) {
    const admin = createAdminClient();
    const items: NotificationItem[] = [];

    const { data: organizations } = await admin
      .from("organizations")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    for (const organization of organizations ?? []) {
      items.push({
        id: `org-${organization.id}`,
        title: "Organization on the platform",
        description: `${organization.name} is registered on SalaryFlow.`,
        href: "/super-admin/organizations",
        createdAt: timestamp(organization.created_at),
        tone: "info",
        category: "system",
      });
    }

    return this.finish(items, limit);
  }

  private finish(items: NotificationItem[], limit: number) {
    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}
