import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerService } from "./ledger-service";
import { recordAudit } from "./audit-service";

/**
 * Employee thrift (voluntary) savings.
 *
 * The admin switches thrift on for an employee and sets the amount the employee
 * agreed to save. On every salary run that amount is moved out of the salary
 * wallet into a dedicated thrift account after loan deductions. The employee
 * cannot withdraw thrift directly - the chairman releases it into the wallet.
 */

export const THRIFT_APPROVER_ROLES = new Set([
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
]);

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);

const round2 = (value: number) => Math.round(value * 100) / 100;

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

  private async ensureOwner() {
    if (!this.userId || !this.organizationId) {
      return "Unauthorized";
    }
    if (this.role !== "ORGANIZATION_OWNER") {
      return "Only the chairman can approve thrift savings payouts";
    }
    return null;
  }

  /** Thrift balances for every employee in the organization. */
  async getOverview() {
    if (!this.organizationId) return null;

    const admin = createAdminClient();
    const { data: employees } = await admin
      .from("employees")
      .select(
        "id, first_name, last_name, employee_number, thrift_enabled, thrift_amount"
      )
      .eq("organization_id", this.organizationId)
      .order("first_name", { ascending: true });

    const list = employees ?? [];
    const ledger = LedgerService.createForOrganization(this.organizationId);

    const rows = await Promise.all(
      list.map(async (employee) => {
        const balance =
          employee.thrift_enabled && Number(employee.thrift_amount) > 0
            ? await ledger.getThriftBalance(employee.id)
            : 0;
        return {
          id: employee.id as string,
          name: `${employee.first_name} ${employee.last_name}`,
          employeeNumber: employee.employee_number as string,
          enabled: Boolean(employee.thrift_enabled),
          amount: Number(employee.thrift_amount) || 0,
          balance,
        };
      })
    );

    const total = rows.reduce((sum, row) => sum + row.balance, 0);

    return {
      employees: rows,
      enabledCount: rows.filter((row) => row.enabled).length,
      total,
    };
  }

  /** Chairman releases every employee's thrift savings in one action. */
  async releaseAllToWallet() {
    const forbidden = await this.ensureOwner();
    if (forbidden) return { ok: false, error: forbidden };
    if (!this.organizationId) return { ok: false, error: "No organization found" };

    const overview = await this.getOverview();
    if (!overview) return { ok: false, error: "Could not load thrift balances" };

    const ledger = LedgerService.createForOrganization(
      this.organizationId,
      this.userId
    );

    let released = 0;
    let total = 0;
    let failures = 0;

    for (const row of overview.employees) {
      if (!row.enabled || row.balance <= 0) continue;

      const reference = `SLF-THRIFT-PAYOUT-${row.id.slice(0, 8)}-${Date.now()}-${released}`;
      const posted = await ledger.postThriftPayout(row.id, reference, row.balance);
      if (posted.error) {
        failures += 1;
        continue;
      }
      released += 1;
      total += row.balance;
    }

    await recordAudit({
      organizationId: this.organizationId,
      userId: this.userId,
      action: "thrift.released_all",
      entityType: "organization",
      entityId: this.organizationId,
      after: { released, total, failures },
    });

    return {
      ok: true,
      released,
      total: Math.round(total * 100) / 100,
      failures,
    };
  }

  private async getMyEmployee() {
    if (!this.userId) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("employees")
      .select("id, organization_id, first_name, last_name")
      .eq("user_id", this.userId)
      .maybeSingle();
    return data ?? null;
  }

  /** Employee asks the employer to release some or all of their thrift. */
  async requestRelease(amount: number) {
    if (!this.userId) return { ok: false as const, error: "Sign in to continue" };

    const employee = await this.getMyEmployee();
    if (!employee?.id || !employee.organization_id) {
      return { ok: false as const, error: "No employee profile is linked to this account" };
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
        "id, amount, status, notes, reviewed_at, created_at, employees:employee_id(first_name, last_name, employee_number)"
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
        employeeId: "",
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
      return { ok: false as const, error: "This request has already been handled" };
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

    const result = await this.releaseToWallet(
      request.employee_id as string,
      Number(request.amount) || undefined
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

  /** Chairman releases thrift savings into the employee's withdrawable wallet. */  async releaseToWallet(employeeId: string, amount?: number) {
    const forbidden = await this.ensureOwner();
    if (forbidden) return { ok: false, error: forbidden };
    if (!this.organizationId) return { ok: false, error: "No organization found" };

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
}
