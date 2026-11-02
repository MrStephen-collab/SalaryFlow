import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmployeeLoanProduct } from "@/lib/loan-products";

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
  nin: string | null;
  nin_document_url: string | null;
  nin_status: string;
  thrift_enabled: boolean;
  thrift_amount: number;
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
      // Resolve the employee record with the service role: the employees table
      // is staff-readable only, so an employee session cannot see its own row.
      const admin = createAdminClient();
      const { data: employee } = await admin
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

    const admin = createAdminClient();
    const { data } = await admin
      .from("employees")
      .select("*")
      .eq("id", this.employeeId)
      .maybeSingle();

    return (data as EmployeeRow | null) ?? null;
  }

  async getSalaryHistory() {
    if (!this.employeeId) return [];

    const admin = createAdminClient();
    const { data } = await admin
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

    const admin = createAdminClient();
    const { data } = await admin
      .from("salary_periods")
      .select("id, name, start_date, status")
      .eq("organization_id", this.orgId)
      .order("start_date", { ascending: false });

    return data ?? [];
  }

  async getAvailableBalance(): Promise<number> {
    if (!this.employeeId || !this.orgId) return 0;

    const admin = createAdminClient();
    const { data: account } = await admin
      .from("financial_accounts")
      .select("id")
      .eq("employee_id", this.employeeId)
      .eq("account_type", "AVAILABLE_BALANCE")
      .maybeSingle();

    if (!account) return 0;

    const { LedgerService } = await import("./ledger-service");
    const ledger = LedgerService.createForOrganization(this.orgId);
    return ledger.getFinancialAccountBalance(account.id);
  }

  async getThriftBalance(): Promise<number> {
    if (!this.employeeId || !this.orgId) return 0;

    const { LedgerService } = await import("./ledger-service");
    const ledger = LedgerService.createForOrganization(this.orgId);
    return ledger.getThriftBalance(this.employeeId);
  }

  async getTransactions() {
    if (!this.employeeId) return [];

    const admin = createAdminClient();
    const { data: accounts } = await admin
      .from("financial_accounts")
      .select("id, account_type")
      .eq("employee_id", this.employeeId)
      .eq("account_type", "AVAILABLE_BALANCE");

    const accountIds = (accounts ?? []).map((a) => a.id);
    if (accountIds.length === 0) return [];

    const { data: entries } = await admin
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

    const admin = createAdminClient();
    const { data } = await admin
      .from("loan_applications")
      .select(
        `
        *,
        loan_products(name, interest_method)
      `
      )
      .eq("employee_id", this.employeeId)
      .order("created_at", { ascending: false });

    const rows = data ?? [];
    const loanIds = rows.map((row) => row.id as string);
    let paidByLoan = new Map<string, number>();

    if (loanIds.length > 0) {
      const { data: schedules } = await admin
        .from("loan_schedules")
        .select("loan_application_id, total_payment, status")
        .in("loan_application_id", loanIds);

      for (const schedule of schedules ?? []) {
        if (schedule.status !== "PAID") continue;
        const id = schedule.loan_application_id as string;
        paidByLoan.set(
          id,
          (paidByLoan.get(id) ?? 0) + (Number(schedule.total_payment) || 0)
        );
      }
    }

    return rows.map((row) => {
      const product = row.loan_products as unknown as
        | { name: string; interest_method: string }
        | null;
      const totalRepayment = Number(row.total_repayment) || 0;
      const paid = Math.round((paidByLoan.get(row.id as string) ?? 0) * 100) / 100;
      const progressPercent =
        totalRepayment > 0
          ? Math.min(100, Math.round((paid / totalRepayment) * 1000) / 10)
          : 0;

      return {
        ...row,
        productName: product?.name ?? "Loan",
        interestMethod: product?.interest_method ?? "FLAT",
        paidAmount: paid,
        progressPercent,
      };
    });
  }

  /**
   * Employment-period eligibility for employee loans. The organization policy
   * (Settings -> Min Employment Period) decides how long an employee must have
   * worked before applying.
   */
  async getLoanEligibility() {
    if (!this.employeeId || !this.orgId) return null;

    const admin = createAdminClient();
    const [{ data: employee }, { data: products }] = await Promise.all([
      admin.from("employees").select("date_joined").eq("id", this.employeeId).maybeSingle(),
      admin
        .from("loan_products")
        .select("name, minimum_employment_period_months")
        .eq("organization_id", this.orgId)
        .eq("active", true),
    ]);

    // Member loan products never gate employee eligibility.
    const employeeProducts = (products ?? []).filter((product) =>
      isEmployeeLoanProduct(product)
    );

    // Eligibility comes from the loan products; the least demanding active
    // product is what the portal page uses as the general gate.
    const requiredMonths =
      employeeProducts.length > 0
        ? Math.min(
            ...employeeProducts.map(
              (p) => Number(p.minimum_employment_period_months) || 0
            )
          )
        : 0;
    const dateJoined = (employee?.date_joined as string | null) ?? null;

    let monthsWorked = 0;
    if (dateJoined) {
      const start = new Date(dateJoined);
      const now = new Date();
      monthsWorked =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      if (now.getDate() < start.getDate()) monthsWorked -= 1;
      monthsWorked = Math.max(0, monthsWorked);
    }

    const remainingMonths = Math.max(0, requiredMonths - monthsWorked);

    return {
      requiredMonths,
      monthsWorked,
      remainingMonths,
      eligible: remainingMonths === 0,
      dateJoined,
    };
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

    const admin = createAdminClient();
    const { data } = await admin
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
    const admin = createAdminClient();
    const { data } = await admin
      .from("loan_schedules")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("month_number", { ascending: true });

    return data ?? [];
  }
}