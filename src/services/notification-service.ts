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
  | "thrift"
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
  private memberId: string | null = null;
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
    const [profileResult, employeeResult, memberResult] = await Promise.all([
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
      admin
        .from("members")
        .select("id, organization_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    service.role = profileResult.data?.role ?? null;
    service.isSuperAdmin = service.role === "SUPER_ADMIN";
    service.employeeId = employeeResult.data?.id ?? null;
    service.memberId = memberResult.data?.id ?? null;
    service.orgId =
      employeeResult.data?.organization_id ??
      memberResult.data?.organization_id ??
      profileResult.data?.organization_id ??
      null;

    return service;
  }

  getRole() {
    return this.role;
  }

  async list(limit = 12): Promise<NotificationItem[]> {
    if (this.isSuperAdmin) return this.platformNotifications(limit);
    if (this.memberId) return this.memberNotifications(limit);
    if (this.employeeId && this.role === "EMPLOYEE") {
      return this.employeeNotifications(limit);
    }
    if (this.orgId) return this.staffNotifications(limit);
    return [];
  }

  /** External member feed: savings activity, membership and loans. */
  private async memberNotifications(limit: number) {
    if (!this.orgId || !this.memberId) return [];
    const admin = createAdminClient();
    const items: NotificationItem[] = [];

    const [loans, savings, schedules, member, withdrawals] = await Promise.all([
      admin
        .from("loan_applications")
        .select("id, status, amount, created_at, submitted_at, approved_at, rejected_at, disbursed_at, processing_fee, insurance_fee, rejection_reason")
        .eq("member_id", this.memberId)
        .order("updated_at", { ascending: false })
        .limit(20),
      admin
        .from("savings_transactions")
        .select("id, transaction_type, amount, direction, reference, description, created_at")
        .eq("member_id", this.memberId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("loan_schedules")
        .select(
          `
          id, status, due_date, total_payment, paid_amount,
          loan_applications!inner(id, member_id, status)
        `
        )
        .eq("loan_applications.member_id", this.memberId)
        .in("loan_applications.status", ["ACTIVE", "DEFAULTED"])
        .in("status", ["DUE", "LATE", "UPCOMING"])
        .lte("due_date", daysFromNow(7))
        .order("due_date", { ascending: true })
        .limit(10),
      admin
        .from("members")
        .select("status, joined_at, created_at")
        .eq("id", this.memberId)
        .maybeSingle(),
      admin
        .from("withdrawal_requests")
        .select(
          "id, status, amount, reference, created_at, updated_at, paid_at, processed_at, approved_at, failure_reason"
        )
        .eq("member_id", this.memberId)
        .in("status", ["PENDING", "APPROVED", "PROCESSING", "PAID", "REJECTED", "FAILED"])
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    for (const loan of loans.data ?? []) {
      const amount = naira(Number(loan.amount) || 0);

      if (loan.status === "SUBMITTED" || loan.status === "UNDER_REVIEW") {
        items.push({
          id: `member-loan-submitted-${loan.id}`,
          title: "Loan request submitted",
          description: `Your ${amount} loan request is awaiting approval.`,
          href: "/member/loans",
          createdAt: timestamp(loan.submitted_at, loan.created_at),
          tone: "info",
          category: "loan",
          amount: Number(loan.amount) || 0,
        });
      } else if (loan.status === "APPROVED") {
        items.push({
          id: `member-loan-approved-${loan.id}`,
          title: "Loan approved",
          description: `Your ${amount} loan was approved and is awaiting disbursement.`,
          href: "/member/loans",
          createdAt: timestamp(loan.approved_at, loan.created_at),
          tone: "success",
          category: "loan",
          amount: Number(loan.amount) || 0,
        });
      } else if (loan.status === "ACTIVE" || loan.status === "DISBURSED") {
        const fees =
          (Number(loan.processing_fee) || 0) +
          (Number(loan.insurance_fee) || 0);
        items.push({
          id: `member-loan-active-${loan.id}`,
          title: "Loan disbursed",
          description:
            fees > 0
              ? `Your ${amount} loan has been disbursed. ${naira(
                  Math.max(0, (Number(loan.amount) || 0) - fees)
                )} was credited after ${naira(fees)} fees.`
              : `Your ${amount} loan has been credited to your savings wallet.`,
          href: "/member/loans",
          createdAt: timestamp(loan.disbursed_at, loan.approved_at, loan.created_at),
          tone: "success",
          category: "loan",
          amount: Number(loan.amount) || 0,
        });
      } else if (loan.status === "REJECTED") {
        items.push({
          id: `member-loan-rejected-${loan.id}`,
          title: "Loan request declined",
          description: loan.rejection_reason || `Your ${amount} loan request was declined.`,
          href: "/member/loans",
          createdAt: timestamp(loan.rejected_at, loan.created_at),
          tone: "danger",
          category: "loan",
          amount: Number(loan.amount) || 0,
        });
      } else if (loan.status === "COMPLETED") {
        items.push({
          id: `member-loan-completed-${loan.id}`,
          title: "Loan completed",
          description: `You have fully repaid your ${amount} loan.`,
          href: "/member/loans",
          createdAt: timestamp(loan.created_at),
          tone: "success",
          category: "loan",
          amount: Number(loan.amount) || 0,
        });
      }
    }

    for (const tx of savings.data ?? []) {
      const amount = naira(Number(tx.amount) || 0);
      if (tx.transaction_type === "DEPOSIT") {
        items.push({
          id: `member-savings-deposit-${tx.id}`,
          title: "Savings deposit received",
          description: `${amount} was credited to your savings.`,
          href: "/member/savings",
          createdAt: timestamp(tx.created_at),
          tone: "success",
          category: "system",
          amount: Number(tx.amount) || 0,
          reference: tx.reference ?? undefined,
        });
      } else if (tx.transaction_type === "WITHDRAWAL") {
        items.push({
          id: `member-savings-withdrawal-${tx.id}`,
          title: "Savings withdrawal",
          description: `${amount} was paid out${tx.description ? ` · ${tx.description}` : ""}.`,
          href: "/member/savings",
          createdAt: timestamp(tx.created_at),
          tone: "info",
          category: "withdrawal",
          amount: Number(tx.amount) || 0,
          reference: tx.reference ?? undefined,
        });
      } else if (
        tx.transaction_type === "INTEREST" ||
        tx.transaction_type === "ADJUSTMENT"
      ) {
        items.push({
          id: `member-savings-${tx.transaction_type.toLowerCase()}-${tx.id}`,
          title:
            tx.transaction_type === "INTEREST"
              ? "Savings interest credited"
              : "Savings adjustment",
          description: `${amount} was ${
            tx.transaction_type === "INTEREST" ? "credited as interest" : "adjusted"
          } on your savings${tx.description ? ` · ${tx.description}` : ""}.`,
          href: "/member/savings",
          createdAt: timestamp(tx.created_at),
          tone: "success",
          category: "system",
          amount: Number(tx.amount) || 0,
          reference: tx.reference ?? undefined,
        });
      }
    }

    for (const withdrawal of withdrawals.data ?? []) {
      const amount = naira(Number(withdrawal.amount) || 0);
      const map: Record<string, { title: string; tone: NotificationTone }> = {
        PENDING: { title: "Withdrawal request submitted", tone: "info" },
        APPROVED: { title: "Withdrawal approved", tone: "info" },
        PROCESSING: { title: "Withdrawal processing", tone: "info" },
        PAID: { title: "Withdrawal paid", tone: "success" },
        REJECTED: { title: "Withdrawal declined", tone: "danger" },
        FAILED: { title: "Withdrawal failed", tone: "danger" },
      };
      const entry = map[withdrawal.status];
      if (!entry) continue;

      items.push({
        id: `member-withdrawal-${withdrawal.status.toLowerCase()}-${withdrawal.id}`,
        title: entry.title,
        description:
          withdrawal.failure_reason ||
          `${amount} from your savings wallet${withdrawal.reference ? ` · ${withdrawal.reference}` : ""}.`,
        href: "/member/withdrawals",
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

    for (const schedule of schedules.data ?? []) {
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

      items.push({
        id: `member-schedule-${schedule.status.toLowerCase()}-${schedule.id}`,
        title:
          schedule.status === "LATE"
            ? "Loan repayment overdue"
            : schedule.status === "DUE"
              ? "Loan repayment due"
              : "Loan repayment due soon",
        description: `${naira(outstanding)} is due on ${due}.`,
        href: "/member/loans",
        createdAt: timestamp(schedule.due_date),
        tone: schedule.status === "DUE" || schedule.status === "LATE" ? "danger" : "info",
        category: "loan",
        amount: outstanding,
      });
    }

    if (member.data?.status === "ACTIVE") {
      items.push({
        id: `member-membership-${this.memberId}`,
        title: "Membership active",
        description: "Your membership is active. Keep saving to grow your loan limit.",
        href: "/member",
        createdAt: timestamp(member.data.joined_at, member.data.created_at),
        tone: "success",
        category: "system",
      });
    }

    return this.finish(items, limit);
  }


  private async employeeNotifications(limit: number) {
    if (!this.orgId || !this.employeeId) return [];
    const admin = createAdminClient();
    const items: NotificationItem[] = [];

    const [loans, withdrawals, fundings, schedules, thriftRequests, interestAccruals] =
      await Promise.all([
        admin
          .from("loan_applications")
          .select(
            `
          id, status, amount, created_at, submitted_at, updated_at, approved_at, rejected_at,
          disbursed_at, processing_fee, insurance_fee,
          rejection_reason,
          loan_products:loan_product_id(name)
        `
          )
          .eq("employee_id", this.employeeId)
          .in("status", [
            "SUBMITTED",
            "UNDER_REVIEW",
            "APPROVED",
            "REJECTED",
            "ACTIVE",
            "DISBURSED",
            "COMPLETED",
          ])
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
          .from("thrift_fundings")
          .select(
            "id, period_month, amount, loan_repayment_applied, thrift_credit, reference, created_at"
          )
          .eq("employee_id", this.employeeId)
          .order("period_month", { ascending: false })
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
        admin
          .from("thrift_release_requests")
          .select("id, amount, status, notes, reviewed_at, created_at")
          .eq("employee_id", this.employeeId)
          .in("status", ["PENDING", "PAID", "REJECTED"])
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("thrift_interest_accruals")
          .select("id, period_month, interest_amount, created_at, status")
          .eq("employee_id", this.employeeId)
          .eq("status", "POSTED")
          .order("period_month", { ascending: false })
          .limit(24),
      ]);

    for (const loan of loans.data ?? []) {
      const product = unwrap(
        loan.loan_products as unknown as Embedded<{ name: string | null }>
      );
      const label = product?.name ? ` — ${product.name}` : "";
      const amount = naira(Number(loan.amount) || 0);

      switch (loan.status) {
        case "SUBMITTED":
        case "UNDER_REVIEW":
          items.push({
            id: `loan-submitted-${loan.id}`,
            title: "Loan request submitted",
            description: `Your ${amount} loan request${label} is awaiting approval.`,
            href: `/employee/loans/${loan.id}`,
            createdAt: timestamp(
              loan.submitted_at,
              loan.updated_at,
              loan.created_at
            ),
            tone: "info",
            category: "loan",
            amount: Number(loan.amount) || 0,
          });
          break;
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
        case "DISBURSED": {
          const fees =
            (Number(loan.processing_fee) || 0) +
            (Number(loan.insurance_fee) || 0);
          items.push({
            id: `loan-disbursed-${loan.id}`,
            title: "Loan disbursed",
            description:
              fees > 0
                ? `Your ${amount} loan${label} has been disbursed. ${naira(
                    Math.max(0, (Number(loan.amount) || 0) - fees)
                  )} was credited after ${naira(fees)} fees. Repayments are now scheduled.`
                : `Your ${amount} loan${label} has been disbursed. Repayments are now scheduled.`,
            href: `/employee/loans/${loan.id}`,
            createdAt: timestamp(loan.approved_at, loan.updated_at, loan.created_at),
            tone: "info",
            category: "loan",
            amount: Number(loan.amount) || 0,
          });
          break;
        }
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

    for (const funding of fundings.data ?? []) {
      const amount = Number(funding.amount) || 0;
      const toLoan = Number(funding.loan_repayment_applied) || 0;
      const toSavings = Number(funding.thrift_credit) || 0;
      const periodLabel = new Date(
        `${funding.period_month}T00:00:00Z`
      ).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      items.push({
        id: `thrift-funded-${funding.id}`,
        title: "Thrift savings funded",
        description: `${naira(amount)} funded for ${periodLabel} · ${naira(
          toLoan
        )} to your loan and ${naira(toSavings)} to savings.`,
        href: "/employee/money",
        createdAt: timestamp(funding.created_at),
        tone: "success",
        category: "thrift",
        amount,
        reference: funding.reference ?? undefined,
      });
    }

    for (const request of thriftRequests.data ?? []) {
      const amount = Number(request.amount) || 0;
      const requestDate = new Date(request.created_at).toLocaleDateString(
        "en-GB"
      );
      if (request.status === "PENDING") {
        items.push({
          id: `thrift-release-pending-${request.id}`,
          title: "Thrift release request sent",
          description: `Your ${naira(amount)} release request is awaiting the chairman's approval.`,
          href: "/employee/money",
          createdAt: timestamp(request.created_at),
          tone: "info",
          category: "thrift",
          amount,
        });
      } else if (request.status === "PAID") {
        items.push({
          id: `thrift-release-approved-${request.id}`,
          title: "Thrift release approved",
          description: `${naira(amount)} was released from your thrift savings into your wallet.`,
          href: "/employee/money",
          createdAt: timestamp(request.reviewed_at, request.created_at),
          tone: "success",
          category: "thrift",
          amount,
        });
      } else if (request.status === "REJECTED") {
        items.push({
          id: `thrift-release-rejected-${request.id}`,
          title: "Thrift release declined",
          description:
            request.notes ||
            `Your ${naira(amount)} release request from ${requestDate} was declined.`,
          href: "/employee/money",
          createdAt: timestamp(request.reviewed_at, request.created_at),
          tone: "danger",
          category: "thrift",
          amount,
        });
      }
    }

    for (const accrual of interestAccruals.data ?? []) {
      const interest = Number(accrual.interest_amount) || 0;
      if (interest <= 0) continue;
      const periodLabel = new Date(
        `${accrual.period_month}T00:00:00Z`
      ).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      items.push({
        id: `thrift-interest-${accrual.id}`,
        title: "Thrift interest credited",
        description: `${naira(interest)} interest was added to your thrift savings for ${periodLabel}.`,
        href: "/employee/money",
        createdAt: timestamp(accrual.created_at),
        tone: "success",
        category: "thrift",
        amount: interest,
      });
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

    const [
      applications,
      withdrawals,
      schedules,
      settlementRequests,
      thriftRequests,
    ] = await Promise.all([
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
      admin
        .from("thrift_release_requests")
        .select(
          "id, amount, created_at, employees:employee_id(first_name, last_name)"
        )
        .eq("organization_id", this.orgId)
        .eq("status", "PENDING")
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

    for (const request of thriftRequests.data ?? []) {
      const employee = unwrap(
        request.employees as unknown as Embedded<{
          first_name: string | null;
          last_name: string | null;
        }>
      );
      const name = employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
        : "An employee";
      const amount = Number(request.amount) || 0;

      items.push({
        id: `thrift-request-${request.id}`,
        title: "Thrift release request",
        description: `${name} asked to release ${naira(amount)} from their thrift savings.`,
        href: "/dashboard/employees/thrift",
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
