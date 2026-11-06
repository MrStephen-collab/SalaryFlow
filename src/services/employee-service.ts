import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allocateEmployeeNumber } from "@/lib/employee-number";
import { recordAudit } from "./audit-service";

const SEARCH_FIELDS = [
  "first_name",
  "last_name",
  "other_names",
  "employee_number",
  "email",
  "phone",
  "position",
] as const;

/**
 * PostgREST splits `or`/`and` filters on commas and parentheses, so values
 * containing those characters must be double quoted.
 */
function postgrestValue(value: string) {
  if (!/[,()"\\]/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface EmployeeListParams {
  search?: string;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface EmployeeListResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class EmployeeService {
  constructor(private readonly supabase: SupabaseClient) {}

  static async create() {
    const supabase = await createClient();
    return new EmployeeService(supabase);
  }

  async list(params: EmployeeListParams = {}): Promise<EmployeeListResult> {
    const {
      search,
      department,
      status,
      page = 1,
      pageSize = 20,
    } = params;

    // Resolve current user's organization
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let query = this.supabase
      .from("employees")
      .select("*", { count: "exact" })
      .eq("organization_id", profile.organization_id);

    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean).slice(0, 5);

      if (tokens.length > 0) {
        // Every token must match at least one field, so "Adebayo Akinola"
        // finds the person whose first and last names are split across columns.
        const groups = tokens.map((token) =>
          SEARCH_FIELDS.map(
            (field) => `${field}.ilike.${postgrestValue(`%${token}%`)}`
          ).join(",")
        );

        query =
          groups.length === 1
            ? query.or(groups[0])
            : query.or(`and(${groups.map((group) => `or(${group})`).join(",")})`);
      }
    }

    if (department) {
      query = query.eq("department", department);
    }

    if (status) {
      query = query.eq("employment_status", status);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  }

  async getById(id: string) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) return null;

    const { data } = await this.supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    return data;
  }

  async listDepartments() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) return [];

    const { data } = await this.supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("active", true)
      .order("name");

    return data ?? [];
  }

  async listBranches() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) return [];

    const { data } = await this.supabase
      .from("branches")
      .select("id, name, address")
      .eq("organization_id", profile.organization_id)
      .eq("active", true)
      .order("name");

    return data ?? [];
  }

  async createDepartment(name: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const { data, error } = await this.supabase
      .from("departments")
      .insert({ organization_id: orgId, name })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("This department already exists");
      throw new Error(error.message);
    }
    return data;
  }

  async createBranch(name: string, address?: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const { data, error } = await this.supabase
      .from("branches")
      .insert({ organization_id: orgId, name, address: address || null })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("This branch already exists");
      throw new Error(error.message);
    }
    return data;
  }

  async updateBranch(id: string, name: string, address?: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const { error } = await this.supabase
      .from("branches")
      .update({ name, address: address || null })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      if (error.code === "23505") throw new Error("This branch already exists");
      throw new Error(error.message);
    }
    return true;
  }

  async deleteBranch(id: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const { error } = await this.supabase
      .from("branches")
      .update({ active: false })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) throw new Error(error.message);
    return true;
  }

  async updateDepartment(id: string, name: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    // `departments` currently has no authenticated UPDATE policy, so writes
    // through the user client return zero rows without an error. Write with
    // the service-role client (like audit-service does) and keep the update
    // scoped to the caller's organization.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("departments")
      .update({ name })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select("id");

    if (error) {
      if (error.code === "23505") throw new Error("This department already exists");
      throw new Error(error.message);
    }
    if (!data?.length) throw new Error("Department not found");
    return true;
  }

  async deleteDepartment(id: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    // Same RLS gap as updateDepartment: archive through the service role.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("departments")
      .update({ active: false })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select("id");

    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Department not found");
    return true;
  }

  async getOrgId() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return profile?.organization_id ?? null;
  }

  /**
   * Next free employee number in the organization, following the EMP-0001
   * pattern (max existing number + 1). Employers can still overwrite it.
   */
  async getNextEmployeeNumber(organizationId?: string) {
    const orgId = organizationId ?? (await this.getOrgId());
    if (!orgId) return "EMP-0001";

    return allocateEmployeeNumber(createAdminClient(), orgId);
  }

  async createEmployee(data: Record<string, unknown>) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      throw new Error("No organization associated with this account");
    }

    const providedNumber = String(data.employeeNumber ?? "").trim();
    const employeeNumber =
      providedNumber || (await this.getNextEmployeeNumber(profile.organization_id));

    const { data: employee, error } = await this.supabase
      .from("employees")
      .insert({
        organization_id: profile.organization_id,
        employee_number: employeeNumber,
        first_name: data.firstName,
        last_name: data.lastName,
        other_names: data.otherNames || null,
        email: data.email || null,
        phone: data.phone || null,
        date_of_birth: data.dateOfBirth || null,
        gender: data.gender || null,
        address: data.address || null,
        state: data.state || null,
        lga: data.lga || null,
        nin: data.nin || null,
        nin_document_url: data.ninDocumentUrl || null,
        department: data.department || null,
        position: data.position || null,
        employment_type: data.employmentType,
        employment_status: data.employmentStatus,
        date_joined: data.dateJoined,
        thrift_enabled: Boolean(data.thriftEnabled) && (Number(data.thriftAmount) || 0) > 0,
        thrift_amount: Number(data.thriftAmount) || 0,
        branch_id: data.branchId || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("This employee number already exists");
      }
      throw new Error(error.message);
    }

    await recordAudit({
      organizationId: profile.organization_id,
      userId: user.id,
      action: "employee.created",
      entityType: "employee",
      entityId: employee.id,
      after: {
        employeeNumber: employee.employee_number,
        name: `${employee.first_name} ${employee.last_name}`,
        department: employee.department,
        employmentStatus: employee.employment_status,
      },
    });

    return employee;
  }

  async updateEmployee(id: string, data: Record<string, unknown>) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      throw new Error("No organization associated with this account");
    }

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      employeeNumber: "employee_number",
      firstName: "first_name",
      lastName: "last_name",
      otherNames: "other_names",
      email: "email",
      phone: "phone",
      dateOfBirth: "date_of_birth",
      gender: "gender",
      address: "address",
      state: "state",
      lga: "lga",
      nin: "nin",
      ninDocumentUrl: "nin_document_url",
      department: "department",
      position: "position",
      employmentType: "employment_type",
      employmentStatus: "employment_status",
      dateJoined: "date_joined",
      thriftEnabled: "thrift_enabled",
      thriftAmount: "thrift_amount",
      branchId: "branch_id",
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key];
      if (!dbField) continue;

      if (dbField === "employee_number") {
        const trimmed = String(value ?? "").trim();
        if (!trimmed) continue;
        updateData[dbField] = trimmed;
        continue;
      }

      updateData[dbField] = value === "" ? null : value;
    }

    if (updateData.thrift_amount !== undefined && updateData.thrift_amount !== null) {
      updateData.thrift_amount = Number(updateData.thrift_amount) || 0;

      const { data: activeLoans } = await this.supabase
        .from("loan_applications")
        .select("monthly_deduction")
        .eq("employee_id", id)
        .eq("organization_id", profile.organization_id)
        .in("status", ["ACTIVE", "DISBURSED"]);

      const monthlyRepayment =
        Math.round(
          (activeLoans ?? []).reduce(
            (sum, loan) => sum + (Number(loan.monthly_deduction) || 0),
            0
          ) * 100
        ) / 100;
      if (monthlyRepayment > 0 && Number(updateData.thrift_amount) < monthlyRepayment) {
        throw new Error(
          `This employee's active loan repayments total ${monthlyRepayment.toLocaleString(
            "en-NG",
            { style: "currency", currency: "NGN" }
          )} per month. Their thrift amount cannot be lower than that.`
        );
      }
    }

    if (updateData.thrift_enabled !== undefined) {
      updateData.thrift_enabled = Boolean(updateData.thrift_enabled);
    }
    if (updateData.thrift_amount === 0) {
      updateData.thrift_enabled = false;
    }

    const { error } = await this.supabase
      .from("employees")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (error) throw new Error(error.message);

    await recordAudit({
      organizationId: profile.organization_id,
      userId: user.id,
      action: "employee.updated",
      entityType: "employee",
      entityId: id,
      after: updateData,
    });
  }

  async suspendEmployee(id: string) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      throw new Error("No organization associated with this account");
    }

    const { data: employee } = await this.supabase
      .from("employees")
      .select("employment_status")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    const newStatus =
      employee?.employment_status === "Suspended" ? "Active" : "Suspended";

    const { error } = await this.supabase
      .from("employees")
      .update({ employment_status: newStatus })
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (error) throw new Error(error.message);

    await recordAudit({
      organizationId: profile.organization_id,
      userId: user.id,
      action: "employee.status_changed",
      entityType: "employee",
      entityId: id,
      before: { employmentStatus: employee?.employment_status ?? null },
      after: { employmentStatus: newStatus },
    });

    return newStatus;
  }
}
