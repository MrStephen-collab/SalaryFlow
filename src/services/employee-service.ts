import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
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

    const { error } = await this.supabase
      .from("departments")
      .update({ name })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      if (error.code === "23505") throw new Error("This department already exists");
      throw new Error(error.message);
    }
    return true;
  }

  async deleteDepartment(id: string) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const { error } = await this.supabase
      .from("departments")
      .update({ active: false })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) throw new Error(error.message);
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

    const { data: employee, error } = await this.supabase
      .from("employees")
      .insert({
        organization_id: profile.organization_id,
        employee_number: data.employeeNumber,
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
        department: data.department || null,
        position: data.position || null,
        employment_type: data.employmentType,
        employment_status: data.employmentStatus,
        date_joined: data.dateJoined,
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
      department: "department",
      position: "position",
      employmentType: "employment_type",
      employmentStatus: "employment_status",
      dateJoined: "date_joined",
      branchId: "branch_id",
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key];
      if (!dbField) continue;
      updateData[dbField] = value === "" ? null : value;
    }

    const { error } = await this.supabase
      .from("employees")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (error) throw new Error(error.message);
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

    return newStatus;
  }
}
