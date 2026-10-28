import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";

interface EmployeeRow {
  id: string;
  organization_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
  branch: string | null;
  job_title: string | null;
  employment_type: string;
  employment_status: string;
  date_joined: string | null;
  salary: number;
}

export interface PortalDashboard {
  employee: EmployeeRow;
  salary: number;
  availableBalance: number;
  activeLoan: {
    id: string;
    amount: number;
    totalRepayment: number;
    paid: number;
    outstanding: number;
    monthlyDeduction: number;
    nextPaymentDate: string | null;
    nextPaymentDue: number | null;
    productName: string;
  } | null;
  nextDeduction: string | null;
}

export class EmployeePortalService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private userId: string | null = null;
  private orgId: string | null = null;
  private employeeId: string | null = null;

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  static create = reactCache(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = new EmployeePortalService(supabase);
    service.userId = user?.id ?? null;

    if (user) {
      const { data: employee } = await supabase
        .from("employees")
        .select("id, organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      service.employeeId = employee?.id ?? null;
      service.orgId = employee?.organization_id ?? null;
    }

    return service;
  });

  getEmployeeId() {
    return this.employeeId;
  }

  async getEmployee(): Promise<EmployeeRow | null> {
    if (!this.employeeId) return null;

    const { data } = await this.supabase
      .from("employees")
      .select(
        "id, organization_id, employee_number, first_name, last_name, email, department, branch, job_title, employment_type, employment_status, date_joined, salary"
      )
      .eq("id", this.employeeId)
      .maybeSingle();

    return (data as EmployeeRow | null) ?? null;
  }

  async getSalaryHistory() {
    if (!this.employeeId) return [];

    const { data } = await this.supabase
      .from("salary_records")
      .select(
        `
        id,
        basic_salary,
        allowances,
        gross_salary,
        other_deductions,
        loan_deductions,
        net_salary,
        status,
        created_at,
        salary_periods(name, start_date, end_date, status)
      `
      )
      .eq("employee_id", this.employeeId)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const period = row.salary_periods as unknown as {
        name: string;
        start_date: string;
        end_date: string;
        status: string;
      } | null;
      return {
        id: row.id,
        basicSalary: Number(row.basic_salary ?? 0),
        allowances: Number(row.allowances ?? 0),
        grossSalary: Number(row.gross_salary ?? 0),
        otherDeductions: Number(row.other_deductions ?? 0),
        loanDeductions: Number(row.loan_deductions ?? 0),
        netSalary: Number(row.net_salary ?? 0),
        status: row.status,
        periodName: period?.name ?? "",
        periodStatus: period?.status ?? "",
        periodStartDate: period?.start_date ?? "",
        periodEndDate: period?.end_date ?? "",
      };
    });
  }

  async listPeriods() {
    if (!this.orgId) return [];

    const { data } = await this.supabase
      .from("salary_periods")
      .select("id, name, start_date, status")
      .eq("organization_id", this.orgId)
      .order("start_date", { ascending: false });

    return data ?? [];
  }

  async getAvailableBalance(): Promise<number> {
    if (!this.employeeId || !this.orgId) return 0;

    const { data: account } = await this.supabase
      .from("financial_accounts")
      .select("id")
      .eq("employee_id", this.employeeId)
      .eq("account_type", "AVAILABLE_BALANCE")
      .maybeSingle();

    if (!account) return 0;

    const ledger = await (await import("./ledger-service")).LedgerService.create();
    return ledger.getFinancialAccountBalance(account.id);
  }

  async getTransactions() {
    if (!this.employeeId) return [];

    const { data: accounts } = await this.supabase
      .from("financial_accounts")
      .select("id, account_type")
      .eq("employee_id", this.employeeId);

    const accountIds = (accounts ?? []).map((a) => a.id);
    if (accountIds.length === 0) return [];

    const { data: entries } = await this.supabase
      .from("ledger_entries")
      .select(
        `
        id,
        debit,
        credit,
        description,
        created_at,
        financial_accounts(account_type),
        ledger_transactions!inner(reference, description, transaction_date, transaction_type, status)
      `
      )
      .in("financial_account_id", accountIds)
      .order("created_at", { ascending: false });

    return (entries ?? []).map((row) => {
      const tx = row.ledger_transactions as unknown as {
        reference: string;
        description: string;
        transaction_date: string;
        transaction_type: string;
        status: string;
      };
      const account = row.financial_accounts as unknown as {
        account_type: string;
      } | null;
      return {
        id: row.id,
        debit: Number(row.debit ?? 0),
        credit: Number(row.credit ?? 0),
        description: row.description ?? tx?.description ?? "",
        reference: tx?.reference ?? "",
        transactionDate: tx?.transaction_date ?? row.created_at?.slice(0, 10) ?? "",
        transactionType: tx?.transaction_type ?? "",
        status: tx?.status ?? "",
        accountType: account?.account_type ?? "",
      };
    });
  }

  async getLoans() {
    if (!this.employeeId) return [];

    const { data } = await this.supabase
      .from("loan_applications")
      .select(
        `
        *,
        loan_products(name, interest_method)
      `
      )
      .eq("employee_id", this.employeeId)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const product = row.loan_products as unknown as
        | { name: string; interest_method: string }
        | null;
      return {
        ...row,
        productName: product?.name ?? "Loan",
        interestMethod: product?.interest_method ?? "FLAT",
      };
    });
  }

  async getActiveLoan() {
    const loans = await this.getLoans();
    const active = loans.find(
      (loan) =>
        loan.status === "ACTIVE" ||
        loan.status === "DISBURSED" ||
        loan.status === "APPROVED" ||
        loan.status === "READY_FOR_DISBURSEMENT"
    );
    if (!active) return null;

    const schedules = await this.getSchedule(active.id);
    const paid = schedules
      .filter((s) => s.status === "PAID")
      .reduce((sum, s) => sum + Number(s.total_payment), 0);
    const totalRepayment = Number(active.total_repayment) || 0;
    const next = schedules.find((s) => s.status === "DUE" || s.status === "UPCOMING");

    return {
      id: active.id,
      amount: Number(active.amount),
      totalRepayment,
      paid,
      outstanding: totalRepayment - paid,
      monthlyDeduction: Number(active.monthly_deduction) || 0,
      nextPaymentDate: next?.due_date ?? null,
      nextPaymentDue: next ? Number(next.total_payment) : null,
      productName: active.productName,
    };
  }

  async getLoanDetail(loanId: string) {
    if (!this.employeeId || !this.orgId) return null;

    const { data } = await this.supabase
      .from("loan_applications")
      .select(
        `
        *,
        loan_products(name, interest_rate, interest_method, duration_months)
      `
      )
      .eq("id", loanId)
      .eq("employee_id", this.employeeId)
      .eq("organization_id", this.orgId)
      .maybeSingle();

    if (!data) return null;

    const product = data.loan_products as unknown as {
      name: string;
      interest_rate: number;
      interest_method: string;
      duration_months: number;
    } | null;

    const schedules = await this.getSchedule(data.id);
    const paid = schedules
      .filter((s) => s.status === "PAID")
      .reduce((sum, s) => sum + Number(s.total_payment), 0);
    const totalRepayment = Number(data.total_repayment) || 0;

    return {
      ...data,
      productName: product?.name ?? "Loan",
      interestRate: product?.interest_rate ?? 0,
      interestMethod: product?.interest_method ?? "FLAT",
      productDuration: product?.duration_months ?? 0,
      paid,
      outstanding: totalRepayment - paid,
      schedule: schedules,
      progress: totalRepayment > 0 ? Math.round((paid / totalRepayment) * 100) : 0,
    };
  }

  async getSchedule(applicationId: string) {
    const { data } = await this.supabase
      .from("loan_schedules")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("month_number", { ascending: true });

    return data ?? [];
  }
}