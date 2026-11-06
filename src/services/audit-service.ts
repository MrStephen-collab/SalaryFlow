import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append-only audit trail (spec #56).
 *
 * `recordAudit` is fire-and-forget: an audit failure must never break the
 * financial operation that triggered it. Rows live in `audit_logs` and are
 * written through the service-role client so RLS cannot silently drop them.
 */

export interface AuditContext {
  organizationId?: string | null;
  userId?: string | null;
}

export interface AuditEntry extends AuditContext {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function asJson(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      id: crypto.randomUUID(),
      organization_id: entry.organizationId ?? null,
      user_id: entry.userId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before_data: asJson(entry.before),
      after_data: asJson(entry.after),
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[audit] failed to record", entry.action, error.message);
    }
  } catch (error) {
    console.error("[audit] failed to record", entry.action, error);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "organization.updated": "Organization profile updated",
  "settings.updated": "Financial settings updated",
  "employee.created": "Employee created",
  "employee.updated": "Employee updated",
  "employee.status_changed": "Employee status changed",
  "loan.product_created": "Loan product created",
  "loan.product_updated": "Loan product updated",
  "loan.product_activated": "Loan product activated",
  "loan.product_deactivated": "Loan product deactivated",
  "loan.product_deleted": "Loan product deleted",
  "loan.application_submitted": "Loan application submitted",
  "loan.approved": "Loan approved",
  "loan.rejected": "Loan rejected",
  "loan.disbursed": "Loan disbursed",
  "loan.repayment_recorded": "Loan repayment recorded",
  "loan.completed": "Loan completed",
  "loan.early_settlement_requested": "Early settlement requested",
  "loan.settled_early": "Loan settled early",
  "loan.restructured": "Loan restructured",
  "withdrawal.requested": "Withdrawal requested",
  "withdrawal.review": "Withdrawal sent for review",
  "withdrawal.approved": "Withdrawal approved",
  "withdrawal.rejected": "Withdrawal rejected",
  "withdrawal.processing": "Withdrawal sent to provider",
  "withdrawal.paid": "Withdrawal paid",
  "withdrawal.failed": "Withdrawal failed",
  "withdrawal.bank_account_added": "Bank account added",
  "withdrawal.bank_account_removed": "Bank account removed",
  "thrift.funded": "Thrift savings funded",
  "thrift.released": "Thrift savings released",
  "thrift.released_all": "All thrift savings released",
  "employee.thrift_updated": "Thrift amount updated",
  "collections.overdue_swept": "Overdue loans refreshed",
  "collections.loan_defaulted": "Loan marked as defaulted",
  "fund.account_created": "Fund account created",
  "fund.movement": "Fund movement recorded",
  "ledger.transaction_posted": "Ledger transaction posted",
  "ledger.transaction_reversed": "Ledger transaction reversed",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  organization: "Organization",
  settings: "Settings",
  employee: "Employee",
  loan_product: "Loan product",
  loan_application: "Loan application",
  loan_repayment: "Loan repayment",
  withdrawal: "Withdrawal",
  bank_account: "Bank account",
  thrift_funding: "Thrift funding",
  fund_account: "Fund account",
  fund_transaction: "Fund transaction",
  ledger_transaction: "Ledger transaction",
};

export function auditActionLabel(action: string) {
  return (
    AUDIT_ACTION_LABELS[action] ??
    action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function auditEntityLabel(entityType: string) {
  return (
    AUDIT_ENTITY_LABELS[entityType] ??
    entityType.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export interface AuditLogRow {
  id: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityLabel: string;
  entityId: string | null;
  actorName: string;
  actorEmail: string;
  ipAddress: string | null;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditListParams {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface AuditListResult {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const AUDIT_VIEWER_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "AUDITOR",
  "SUPER_ADMIN",
]);

export class AuditService {
  private orgId: string | null = null;
  private userId: string | null = null;
  private role: string | null = null;

  private constructor() {}

  static async create() {
    const service = new AuditService();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return service;

    const profile = await AuditService.loadProfile(user.id);
    service.userId = user.id;
    service.orgId = profile?.organization_id ?? null;
    service.role = profile?.role ?? null;

    return service;
  }

  private static async loadProfile(userId: string) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("organization_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  }

  canViewAuditLog(): boolean {
    return Boolean(this.role && AUDIT_VIEWER_ROLES.has(this.role));
  }

  private canViewOrganization(): boolean {
    return Boolean(this.orgId) && this.canViewAuditLog();
  }

  async list(params: AuditListParams = {}): Promise<AuditListResult> {
    const empty: AuditListResult = {
      rows: [],
      total: 0,
      page: 1,
      pageSize: params.pageSize ?? 25,
      totalPages: 0,
    };

    if (!this.canViewOrganization()) return empty;

    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 25));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const admin = createAdminClient();
    let query = admin
      .from("audit_logs")
      .select(
        "id, action, entity_type, entity_id, ip_address, created_at, before_data, after_data, users(email, full_name)",
        { count: "exact" }
      )
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.entityType) {
      query = query.eq("entity_type", params.entityType);
    }
    if (params.action) {
      query = query.eq("action", params.action);
    }
    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }
    if (params.from) {
      query = query.gte("created_at", `${params.from}T00:00:00.000Z`);
    }
    if (params.to) {
      query = query.lte("created_at", `${params.to}T23:59:59.999Z`);
    }
    if (params.search) {
      const term = params.search.replace(/[%,()]/g, " ").trim();
      if (term) query = query.ilike("action", `%${term}%`);
    }

    const { data, count } = await query;

    const rows = (data ?? []).map((row) => {
      const actor = row.users as unknown as {
        email: string | null;
        full_name: string | null;
      } | null;
      return {
        id: row.id,
        action: row.action,
        actionLabel: auditActionLabel(row.action),
        entityType: row.entity_type,
        entityLabel: auditEntityLabel(row.entity_type),
        entityId: row.entity_id,
        actorName: actor?.full_name || actor?.email || "System",
        actorEmail: actor?.email ?? "",
        ipAddress: row.ip_address,
        createdAt: row.created_at,
        before: (row.before_data as Record<string, unknown> | null) ?? null,
        after: (row.after_data as Record<string, unknown> | null) ?? null,
      } satisfies AuditLogRow;
    });

    const total = count ?? rows.length;

    return {
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
