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

  /** Chairman releases thrift savings into the employee's withdrawable wallet. */
  async releaseToWallet(employeeId: string, amount?: number) {
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
