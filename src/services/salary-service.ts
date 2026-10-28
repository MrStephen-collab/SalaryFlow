import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface SalaryRecord {
  id: string;
  employee_id: string;
  employee_number: string;
  employee_name: string;
  department: string | null;
  basic_salary: number;
  allowances: number;
  gross_salary: number;
  other_deductions: number;
  loan_deductions: number;
  net_salary: number;
  status: string;
}

export class SalaryService {
  constructor(private readonly supabase: SupabaseClient) {}

  static async create() {
    const supabase = await createClient();
    return new SalaryService(supabase);
  }

  private async getOrgId() {
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

  async listPeriods() {
    const orgId = await this.getOrgId();
    if (!orgId) return [];

    const { data } = await this.supabase
      .from("salary_periods")
      .select("*, salary_records(count)")
      .eq("organization_id", orgId)
      .order("start_date", { ascending: false });

    return data ?? [];
  }

  async listEmployeeIdentifiers() {
    const orgId = await this.getOrgId();
    if (!orgId) return [];

    const { data } = await this.supabase
      .from("employees")
      .select("employee_number, first_name, last_name")
      .eq("organization_id", orgId)
      .eq("employment_status", "Active")
      .order("first_name");

    return data ?? [];
  }

  async getPeriod(id: string) {
    const orgId = await this.getOrgId();
    if (!orgId) return null;

    const { data } = await this.supabase
      .from("salary_periods")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    return data;
  }

  async createPeriod(data: {
    name: string;
    startDate: string;
    endDate: string;
    paymentDate: string;
  }) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const { error } = await this.supabase.from("salary_periods").insert({
      organization_id: orgId,
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      payment_date: data.paymentDate,
      status: "DRAFT",
    });

    if (error) {
      if (error.code === "23505") throw new Error("This salary period already exists");
      throw new Error(error.message);
    }
  }

  async getSalaryRecords(periodId: string): Promise<SalaryRecord[]> {
    const orgId = await this.getOrgId();
    if (!orgId) return [];

    const { data: period } = await this.supabase
      .from("salary_periods")
      .select("organization_id")
      .eq("id", periodId)
      .single();

    if (!period || period.organization_id !== orgId) return [];

    const { data } = await this.supabase
      .from("salary_records")
      .select(
        `
        id,
        employee_id,
        basic_salary,
        allowances,
        gross_salary,
        other_deductions,
        loan_deductions,
        net_salary,
        status,
        employees:employee_id(employee_number, first_name, last_name, department)
      `
      )
      .eq("salary_period_id", periodId)
      .order("created_at", { ascending: true });

    return (data ?? []).map((row) => {
      const employeeList = row.employees as unknown as {
        employee_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
      }[];
      const employee = Array.isArray(employeeList) ? employeeList[0] : null;
      return {
        id: row.id,
        employee_id: row.employee_id,
        employee_number: employee?.employee_number ?? "",
        employee_name: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Unknown",
        department: employee?.department ?? null,
        basic_salary: Number(row.basic_salary ?? 0),
        allowances: Number(row.allowances ?? 0),
        gross_salary: Number(row.gross_salary ?? 0),
        other_deductions: Number(row.other_deductions ?? 0),
        loan_deductions: Number(row.loan_deductions ?? 0),
        net_salary: Number(row.net_salary ?? 0),
        status: row.status,
      };
    });
  }

  // Import salary records for a period
  // rows: { employeeNumber, basicSalary, allowances, otherDeductions }
  async importSalaryRecords(
    periodId: string,
    rows: {
      employeeNumber: string;
      basicSalary: number;
      allowances: number;
      otherDeductions: number;
    }[]
  ) {
    const orgId = await this.getOrgId();
    if (!orgId) throw new Error("No organization associated with this account");

    const period = await this.getPeriod(periodId);
    if (!period) throw new Error("Salary period not found");

    // Get all employees in org
    const { data: employees } = await this.supabase
      .from("employees")
      .select("id, employee_number")
      .eq("organization_id", orgId);

    if (!employees) throw new Error("No employees found");

    const employeeByNumber = new Map(
      employees.map((e) => [e.employee_number.toLowerCase(), e.id])
    );

    // Validate against schema (light validation)
    const validated: {
      employeeId: string;
      basicSalary: number;
      allowances: number;
      otherDeductions: number;
    }[] = [];

    for (const row of rows) {
      const employeeId = employeeByNumber.get(row.employeeNumber.toLowerCase());
      if (!employeeId) {
        throw new Error(
          `Employee "${row.employeeNumber}" not found in organization`
        );
      }
      validated.push({
        employeeId,
        basicSalary: Number(row.basicSalary) || 0,
        allowances: Number(row.allowances) || 0,
        otherDeductions: Number(row.otherDeductions) || 0,
      });
    }

    // Build records to upsert
    const records = validated.map((v) => {
      const grossSalary = v.basicSalary + v.allowances;
      const netSalary = grossSalary - v.otherDeductions;
      return {
        organization_id: orgId,
        employee_id: v.employeeId,
        salary_period_id: periodId,
        basic_salary: v.basicSalary,
        allowances: v.allowances,
        gross_salary: grossSalary,
        other_deductions: v.otherDeductions,
        loan_deductions: 0,
        net_salary: netSalary,
        status: "DRAFT",
      };
    });

    const { data, error } = await this.supabase
      .from("salary_records")
      .upsert(records, { onConflict: "employee_id,salary_period_id" })
      .select();

    if (error) throw new Error(error.message);
    return data;
  }
}
