import { createClient } from "@/lib/supabase/server";
import { isSampleEmployeeNumber } from "@/lib/demo";

export interface ReportOptions {
  startDate?: string;
  endDate?: string;
  department?: string;
  branch?: string;
  employee?: string;
  productId?: string;
  status?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  format?: "currency" | "number" | "date" | "datetime";
}

export interface ReportData {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
}

export interface ReportMeta {
  key: string;
  title: string;
  description: string;
  dateLabel: string;
  supportsStatus: boolean;
  statusOptions?: string[];
  supportsProduct: boolean;
  supportsDepartment: boolean;
  supportsBranch: boolean;
  supportsEmployee: boolean;
  currencyColumns: string[];
}

const loanAppStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "ACTIVE",
  "COMPLETED",
  "REJECTED",
];

const withdrawalStatuses = [
  "PENDING",
  "REVIEW",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REJECTED",
];
const txStatuses = ["POSTED", "REVERSED"];
const employeeStatuses = ["Active", "Suspended", "Terminated", "On Leave"];

export function listReportMetas(): ReportMeta[] {
  return [
    {
      key: "employee",
      title: "Employee Report",
      description: "Full employee register with thrift and employment details.",
      dateLabel: "Date Joined",
      supportsStatus: true,
      statusOptions: employeeStatuses,
      supportsProduct: false,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["thriftAmount"],
    },
    {
      key: "thrift",
      title: "Thrift Funding Report",
      description:
        "Monthly employer thrift contributions and how each was split between loan repayment and savings.",
      dateLabel: "Funding Month",
      supportsStatus: true,
      statusOptions: ["POSTED", "REVERSED"],
      supportsProduct: false,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["amount", "loanRepayment", "thriftCredit"],
    },
    {
      key: "thrift-interest",
      title: "Thrift Interest Report",
      description:
        "Monthly interest credited to employee thrift savings, including opening balance, eligible days and closing balance.",
      dateLabel: "Interest Month",
      supportsStatus: true,
      statusOptions: ["POSTED", "REVERSED"],
      supportsProduct: false,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: [
        "openingBalance",
        "contributions",
        "payouts",
        "interest",
        "closingBalance",
      ],
    },
    {
      key: "loan-applications",
      title: "Loan Application Report",
      description: "All loan applications with amounts and statuses.",
      dateLabel: "Applied",
      supportsStatus: true,
      statusOptions: loanAppStatuses,
      supportsProduct: true,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["amount", "monthlyDeduction", "totalRepayment"],
    },
    {
      key: "loan-portfolio",
      title: "Loan Portfolio",
      description: "Outstanding loans with repaid, outstanding and aging.",
      dateLabel: "Disbursed",
      supportsStatus: true,
      statusOptions: ["ACTIVE", "APPROVED", "READY_FOR_DISBURSEMENT"],
      supportsProduct: true,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["loanAmount", "repaid", "outstanding", "monthlyDeduction"],
    },
    {
      key: "repayments",
      title: "Repayment Report",
      description: "Recorded loan repayments.",
      dateLabel: "Recorded",
      supportsStatus: false,
      supportsProduct: true,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["amount"],
    },
    {
      key: "default",
      title: "Default Report",
      description: "Loans with overdue or late installments.",
      dateLabel: "Due From",
      supportsStatus: false,
      supportsProduct: true,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["loanAmount", "overdueAmount", "outstanding"],
    },
    {
      key: "fund",
      title: "Fund Report",
      description: "Movements in and out of the thrift pool.",
      dateLabel: "Date",
      supportsStatus: false,
      supportsProduct: false,
      supportsDepartment: false,
      supportsBranch: false,
      supportsEmployee: false,
      currencyColumns: ["amount"],
    },
    {
      key: "interest-income",
      title: "Loan Interest Income",
      description: "Interest earned from employee and member loans.",
      dateLabel: "Transaction Date",
      supportsStatus: false,
      supportsProduct: false,
      supportsDepartment: false,
      supportsBranch: false,
      supportsEmployee: false,
      currencyColumns: ["interest"],
    },
    {
      key: "withdrawal",
      title: "Withdrawal Report",
      description: "Employee withdrawal requests and payouts.",
      dateLabel: "Requested",
      supportsStatus: true,
      statusOptions: withdrawalStatuses,
      supportsProduct: false,
      supportsDepartment: true,
      supportsBranch: true,
      supportsEmployee: true,
      currencyColumns: ["amount", "fee", "netAmount"],
    },
    {
      key: "transaction",
      title: "Transaction Report",
      description: "Ledger transactions with debits and credits.",
      dateLabel: "Transaction Date",
      supportsStatus: true,
      statusOptions: txStatuses,
      supportsProduct: false,
      supportsDepartment: false,
      supportsBranch: false,
      supportsEmployee: false,
      currencyColumns: ["debit", "credit"],
    },
    {
      key: "audit",
      title: "Audit Report",
      description: "Audit trail of financial actions.",
      dateLabel: "Date",
      supportsStatus: false,
      supportsProduct: false,
      supportsDepartment: false,
      supportsBranch: false,
      supportsEmployee: false,
      currencyColumns: [],
    },
  ];
}

export function getReportMeta(key: string): ReportMeta | undefined {
  return listReportMetas().find((m) => m.key === key);
}

const nairaFormatColumns = new Set(
  listReportMetas().flatMap((m) => m.currencyColumns)
);

export function columnFormat(key: string): ReportColumn["format"] {
  if (nairaFormatColumns.has(key)) return "currency";
  if (/date|_at|_date/i.test(key)) return "date";
  return undefined;
}

function fullName(first: string, last: string) {
  return `${first} ${last}`;
}

function inDateRange(value: unknown, start?: string, end?: string) {
  if (!start && !end) return true;
  const dateStr = String(value ?? "").slice(0, 10);
  if (!dateStr) return true;
  if (start && dateStr < start) return false;
  if (end && dateStr > end) return false;
  return true;
}

function employeeMatch(department?: string, branch?: string, employee?: string) {
  return (row: Record<string, unknown>) => {
    if (department && row.department !== department) return false;
    if (branch && row.branch !== branch) return false;
    if (employee) {
      const num = String(row.employeeNumber ?? "").toLowerCase();
      const name = String(row.employeeName ?? "").toLowerCase();
      const q = employee.toLowerCase();
      if (!num.includes(q) && !name.includes(q)) return false;
    }
    return true;
  };
}

export class ReportService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = new ReportService(supabase);
    if (user) {
      const { data: employee } = await supabase
        .from("employees")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (employee?.organization_id) {
        service.orgId = employee.organization_id;
      } else {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();
        service.orgId = profile?.organization_id ?? null;
      }
    }
    return service;
  }

  hasAccess(): boolean {
    return !!this.orgId;
  }

  async listDepartments() {
    if (!this.orgId) return [];
    const { data } = await this.supabase
      .from("employees")
      .select("department")
      .eq("organization_id", this.orgId)
      .neq("department", "")
      .not("department", "is", null);
    return Array.from(new Set((data ?? []).map((r) => r.department))).sort();
  }

  async listBranches() {
    if (!this.orgId) return [];
    const { data } = await this.supabase
      .from("branches")
      .select("name")
      .eq("organization_id", this.orgId)
      .order("name");
    return (data ?? []).map((r) => r.name).filter(Boolean) as string[];
  }

  async listProducts() {
    if (!this.orgId) return [];
    const { data } = await this.supabase
      .from("loan_products")
      .select("id, name")
      .eq("organization_id", this.orgId)
      .order("name");
    return data ?? [];
  }

  // ================= REPORTS =================

  private async employeeReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "employee", title: "Employee Report", columns: [], rows: [], totals: {} };

    let query = this.supabase
      .from("employees")
      .select(
        `
        employee_number,
        first_name,
        last_name,
        department,
        position,
        branch,
        employment_type,
        employment_status,
        thrift_enabled,
        thrift_amount,
        email,
        phone,
        date_joined
      `
      )
      .eq("organization_id", this.orgId)
      .order("first_name");

    if (opts.status) query = query.eq("employment_status", opts.status);

    const { data } = await query;

    const rows = (data ?? [])
      .map((r) => ({
        employeeNumber: r.employee_number,
        employeeName: fullName(r.first_name, r.last_name),
        department: r.department ?? "",
        branch: r.branch ?? "",
        jobTitle: r.position ?? "",
        employmentType: r.employment_type,
        employmentStatus: r.employment_status,
        thriftAmount: Number(r.thrift_amount ?? 0),
        thriftEnabled: r.thrift_enabled ? "Yes" : "No",
        email: r.email ?? "",
        phone: r.phone ?? "",
        dateJoined: r.date_joined ?? "",
      }))
      .filter(employeeMatch(opts.department, opts.branch, opts.employee))
      .filter((r) => inDateRange(r.dateJoined, opts.startDate, opts.endDate));

    return {
      key: "employee",
      title: "Employee Report",
      columns: [
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "jobTitle", label: "Job Title" },
        { key: "employmentType", label: "Type" },
        { key: "employmentStatus", label: "Status" },
        { key: "thriftEnabled", label: "Thrift" },
        { key: "thriftAmount", label: "Monthly Thrift", format: "currency" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "dateJoined", label: "Joined", format: "date" },
      ],
      rows,
      totals: {
        thriftAmount: rows.reduce((s, r) => s + Number(r.thriftAmount), 0),
      },
    };
  }

  private async thriftReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId)
      return {
        key: "thrift",
        title: "Thrift Funding Report",
        columns: [],
        rows: [],
        totals: {},
      };

    let query = this.supabase
      .from("thrift_fundings")
      .select(
        `
        id,
        period_month,
        amount,
        loan_repayment_applied,
        thrift_credit,
        status,
        reference,
        employees:employee_id(employee_number, first_name, last_name, department, branch)
      `
      )
      .eq("organization_id", this.orgId);

    if (opts.status) query = query.eq("status", opts.status);

    const { data } = await query;

    const rows = (data ?? [])
      .map((r) => {
        const emp = r.employees as unknown as {
          employee_number: string;
          first_name: string;
          last_name: string;
          department: string | null;
          branch: string | null;
        } | null;
        return {
          periodMonth: r.period_month,
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          amount: Number(r.amount ?? 0),
          loanRepayment: Number(r.loan_repayment_applied ?? 0),
          thriftCredit: Number(r.thrift_credit ?? 0),
          status: r.status,
          reference: r.reference ?? "",
          sample: isSampleEmployeeNumber(emp?.employee_number) ? "Yes" : "No",
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee))
      .filter((r) => inDateRange(r.periodMonth, opts.startDate, opts.endDate));

    return {
      key: "thrift",
      title: "Thrift Funding Report",
      columns: [
        { key: "periodMonth", label: "Funding Month", format: "date" },
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "amount", label: "Funded", format: "currency" },
        { key: "loanRepayment", label: "To Loan", format: "currency" },
        { key: "thriftCredit", label: "To Savings", format: "currency" },
        { key: "status", label: "Status" },
        { key: "reference", label: "Reference" },
        { key: "sample", label: "Sample" },
      ],
      rows,
      totals: {
        amount: rows.reduce((s, r) => s + Number(r.amount), 0),
        loanRepayment: rows.reduce((s, r) => s + Number(r.loanRepayment), 0),
        thriftCredit: rows.reduce((s, r) => s + Number(r.thriftCredit), 0),
      },
    };
  }

  private async thriftInterestReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId)
      return {
        key: "thrift-interest",
        title: "Thrift Interest Report",
        columns: [],
        rows: [],
        totals: {},
      };

    let query = this.supabase
      .from("thrift_interest_accruals")
      .select(
        `
        id,
        period_month,
        opening_balance,
        contributions,
        payouts,
        annual_rate,
        eligible_days,
        interest_amount,
        closing_balance,
        status,
        reference,
        employees:employee_id(employee_number, first_name, last_name, department, branch)
      `
      )
      .eq("organization_id", this.orgId);

    if (opts.status) query = query.eq("status", opts.status);

    const { data } = await query;

    const rows = (data ?? [])
      .map((r) => {
        const emp = r.employees as unknown as {
          employee_number: string;
          first_name: string;
          last_name: string;
          department: string | null;
          branch: string | null;
        } | null;
        return {
          periodMonth: r.period_month,
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          openingBalance: Number(r.opening_balance ?? 0),
          contributions: Number(r.contributions ?? 0),
          payouts: Number(r.payouts ?? 0),
          annualRate: Number(r.annual_rate ?? 0),
          eligibleDays: Number(r.eligible_days ?? 0),
          interest: Number(r.interest_amount ?? 0),
          closingBalance: Number(r.closing_balance ?? 0),
          status: r.status,
          reference: r.reference ?? "",
          sample: isSampleEmployeeNumber(emp?.employee_number) ? "Yes" : "No",
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee))
      .filter((r) => inDateRange(r.periodMonth, opts.startDate, opts.endDate));

    return {
      key: "thrift-interest",
      title: "Thrift Interest Report",
      columns: [
        { key: "periodMonth", label: "Interest Month", format: "date" },
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "openingBalance", label: "Opening", format: "currency" },
        { key: "contributions", label: "Contribution", format: "currency" },
        { key: "payouts", label: "Released", format: "currency" },
        { key: "annualRate", label: "Rate %" },
        { key: "eligibleDays", label: "Days" },
        { key: "interest", label: "Interest", format: "currency" },
        { key: "closingBalance", label: "Closing", format: "currency" },
        { key: "status", label: "Status" },
        { key: "reference", label: "Reference" },
        { key: "sample", label: "Sample" },
      ],
      rows,
      totals: {
        openingBalance: rows.reduce((s, r) => s + Number(r.openingBalance), 0),
        contributions: rows.reduce((s, r) => s + Number(r.contributions), 0),
        payouts: rows.reduce((s, r) => s + Number(r.payouts), 0),
        interest: rows.reduce((s, r) => s + Number(r.interest), 0),
        closingBalance: rows.reduce((s, r) => s + Number(r.closingBalance), 0),
      },
    };
  }

  private async loanApplicationsReport(opts: ReportOptions): Promise<ReportData> {    if (!this.orgId) return { key: "loan-applications", title: "Loan Application Report", columns: [], rows: [], totals: {} };

    let query = this.supabase
      .from("loan_applications")
      .select(
        `
        id,
        created_at,
        amount,
        duration_months,
        monthly_deduction,
        total_repayment,
        status,
        employees(employee_number, first_name, last_name, department, branch),
        loan_products(id, name)
      `
      )
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    if (opts.status) query = query.eq("status", opts.status);

    const { data } = await query;

    const rows = (data ?? [])
      .filter(
        (r) =>
          !opts.productId ||
          (r.loan_products as unknown as { id?: string }[])?.some(
            (p) => p.id === opts.productId
          )
      )
      .map((r) => {
        const emp = (r.employees as unknown as {
          employee_number: string;
          first_name: string;
          last_name: string;
          department: string | null;
          branch: string | null;
        }[])[0];
        const product = (r.loan_products as unknown as { name: string }[])[0];
        return {
          loanId: r.id,
          submittedAt: r.created_at ?? "",
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          product: product?.name ?? "",
          amount: Number(r.amount ?? 0),
          durationMonths: Number(r.duration_months ?? 0),
          monthlyDeduction: Number(r.monthly_deduction ?? 0),
          totalRepayment: Number(r.total_repayment ?? 0),
          status: r.status,
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee))
      .filter((r) => inDateRange(r.submittedAt, opts.startDate, opts.endDate));

    return {
      key: "loan-applications",
      title: "Loan Application Report",
      columns: [
        { key: "submittedAt", label: "Applied", format: "datetime" },
        { key: "loanId", label: "Loan ID" },
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "product", label: "Product" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "durationMonths", label: "Months", format: "number" },
        { key: "monthlyDeduction", label: "Monthly", format: "currency" },
        { key: "totalRepayment", label: "Total Repayment", format: "currency" },
        { key: "status", label: "Status" },
      ],
      rows: rows,
      totals: {
        amount: rows.reduce((s, r) => s + Number(r.amount), 0),
        totalRepayment: rows.reduce((s, r) => s + Number(r.totalRepayment), 0),
      },
    };
  }

  private async loanPortfolioReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "loan-portfolio", title: "Loan Portfolio", columns: [], rows: [], totals: {} };

    const statuses = opts.status
      ? [opts.status]
      : ["ACTIVE", "READY_FOR_DISBURSEMENT", "APPROVED"];

    const { data: applications } = await this.supabase
      .from("loan_applications")
      .select(
        `
        id,
        amount,
        monthly_deduction,
        total_repayment,
        disbursed_at,
        status,
        employees(employee_number, first_name, last_name, department, branch),
        loan_products(id, name)
      `
      )
      .eq("organization_id", this.orgId)
      .in("status", statuses as never[]);

    const ids = (applications ?? []).map((a) => a.id);

    let schedules: { loan_application_id: string; status: string; total_payment: number; due_date: string }[] = [];
    if (ids.length > 0) {
      const { data } = await this.supabase
        .from("loan_schedules")
        .select("loan_application_id, status, total_payment, due_date")
        .in("loan_application_id", ids as never[]);
      schedules = (data ?? []) as typeof schedules;
    }

    const today = new Date().toISOString().slice(0, 10);
    const byLoan = new Map<string, { paid: number; overdue: number; daysDue: number[] }>();
    for (const s of schedules) {
      const entry = byLoan.get(s.loan_application_id) ?? { paid: 0, overdue: 0, daysDue: [] as number[] };
      if (s.status === "PAID") {
        entry.paid += Number(s.total_payment) || 0;
      } else {
        const due = s.due_date ?? "";
        if (s.status === "LATE" || (due && due < today)) {
          entry.overdue += Number(s.total_payment) || 0;
          if (due) {
            entry.daysDue.push(
              Math.floor((new Date(today).getTime() - new Date(due).getTime()) / 86400000)
            );
          }
        }
      }
      byLoan.set(s.loan_application_id, entry);
    }

    const rows = (applications ?? [])
      .filter((r) => !opts.productId || (r.loan_products as unknown as { id: string })?.id === opts.productId)
      .map((r) => {
        const emp = r.employees as unknown as {
          employee_number: string;
          first_name: string;
          last_name: string;
          department: string | null;
          branch: string | null;
        };
        const product = r.loan_products as unknown as { name: string } | null;
        const agg = byLoan.get(r.id) ?? { paid: 0, overdue: 0, daysDue: [] as number[] };
        const amount = Number(r.amount ?? 0);
        const totalRepayment = Number(r.total_repayment ?? 0);
        const repaid = Math.min(agg.paid, totalRepayment);
        const outstanding = totalRepayment - repaid;
        const maxDays = agg.daysDue.length > 0 ? Math.max(...agg.daysDue) : 0;
        const aging =
          agg.daysDue.length === 0
            ? "Current"
            : maxDays > 90
              ? "90+ days"
              : maxDays > 60
                ? "61-90 days"
                : maxDays > 30
                  ? "31-60 days"
                  : "1-30 days";
        return {
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          product: product?.name ?? "",
          loanAmount: amount,
          repaid,
          outstanding,
          monthlyDeduction: Number(r.monthly_deduction ?? 0),
          overdueAmount: agg.overdue,
          aging,
          disbursedAt: r.disbursed_at ?? "",
          status: r.status,
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee));

    return {
      key: "loan-portfolio",
      title: "Loan Portfolio",
      columns: [
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "product", label: "Product" },
        { key: "loanAmount", label: "Loan Amount", format: "currency" },
        { key: "repaid", label: "Repaid", format: "currency" },
        { key: "outstanding", label: "Outstanding", format: "currency" },
        { key: "monthlyDeduction", label: "Monthly", format: "currency" },
        { key: "overdueAmount", label: "Overdue", format: "currency" },
        { key: "aging", label: "Aging" },
        { key: "disbursedAt", label: "Disbursed", format: "date" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        loanAmount: rows.reduce((s, r) => s + Number(r.loanAmount), 0),
        outstanding: rows.reduce((s, r) => s + Number(r.outstanding), 0),
        overdueAmount: rows.reduce((s, r) => s + Number(r.overdueAmount), 0),
      },
    };
  }

  private async repaymentReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "repayment", title: "Repayment Report", columns: [], rows: [], totals: {} };

    const query = this.supabase
      .from("loan_repayments")
      .select(
        `
        recorded_at,
        amount,
        payment_method,
        reference_number,
        loan_applications(amount, employees(employee_number, first_name, last_name, department, branch), loan_products(name))
      `
      )
      .order("recorded_at", { ascending: false });

    const { data } = await query;

    const rows = (data ?? [])
      .map((r) => {
        const app = (r.loan_applications ?? null) as unknown as null | {
          amount: number;
          employees: {
            employee_number: string;
            first_name: string;
            last_name: string;
            department: string | null;
            branch: string | null;
          }[];
          loan_products: { name: string }[];
        };
        const emp = app?.employees?.[0] ?? null;
        const product = app?.loan_products?.[0] ?? null;
        return {
          recordedAt: r.recorded_at ?? "",
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          product: product?.name ?? "",
          amount: Number(r.amount ?? 0),
          paymentMethod: r.payment_method ?? "",
          referenceNumber: r.reference_number ?? "",
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee))
      .filter((r) => inDateRange(r.recordedAt, opts.startDate, opts.endDate));

    return {
      key: "repayments",
      title: "Repayment Report",
      columns: [
        { key: "recordedAt", label: "Recorded", format: "datetime" },
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "product", label: "Product" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "paymentMethod", label: "Method" },
        { key: "referenceNumber", label: "Reference" },
      ],
      rows,
      totals: {
        amount: rows.reduce((s, r) => s + Number(r.amount), 0),
      },
    };
  }

  private async defaultReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "default", title: "Default Report", columns: [], rows: [], totals: {} };

    const { data: schedules } = await this.supabase
      .from("loan_schedules")
      .select(
        `
        status,
        total_payment,
        due_date,
        loan_applications!inner(id, amount, organization_id, status, disbursed_at, monthly_deduction, employees(employee_number, first_name, last_name, department, branch), loan_products(name))
      `
      )
      .eq("loan_applications.organization_id", this.orgId)
      .in("status", ["LATE", "DUE"] as never[]);

    const today = new Date().toISOString().slice(0, 10);

    const rows = (schedules ?? [])
      .map((r) => {
        const app = r.loan_applications as unknown as {
          id: string;
          amount: number;
          monthly_deduction: number;
          status: string;
          disbursed_at: string | null;
          employees: {
            employee_number: string;
            first_name: string;
            last_name: string;
            department: string | null;
            branch: string | null;
          } | null;
          loan_products: { name: string } | null;
        };
        const emp = app?.employees ?? null;
        const due = r.due_date ?? "";
        const daysOverdue = due ? Math.floor((new Date(today).getTime() - new Date(due).getTime()) / 86400000) : 0;
        const aging = daysOverdue > 90 ? "90+ days" : daysOverdue > 60 ? "61-90 days" : daysOverdue > 30 ? "31-60 days" : "1-30 days";
        return {
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          product: app?.loan_products?.name ?? "",
          loanAmount: Number(app?.amount ?? 0),
          overdueAmount: Number(r.total_payment ?? 0),
          outstanding: Number(app?.amount ?? 0),
          daysOverdue,
          aging,
          dueDate: due,
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee));

    return {
      key: "default",
      title: "Default Report",
      columns: [
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "product", label: "Product" },
        { key: "loanAmount", label: "Loan Amount", format: "currency" },
        { key: "overdueAmount", label: "Overdue", format: "currency" },
        { key: "outstanding", label: "Outstanding", format: "currency" },
        { key: "daysOverdue", label: "Days Overdue", format: "number" },
        { key: "aging", label: "Aging" },
        { key: "dueDate", label: "Due", format: "date" },
      ],
      rows,
      totals: {
        overdueAmount: rows.reduce((s, r) => s + Number(r.overdueAmount), 0),
      },
    };
  }

  private async fundReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "fund", title: "Fund Report", columns: [], rows: [], totals: {} };

    const { data } = await this.supabase
      .from("fund_transactions")
      .select("created_at, transaction_type, direction, amount, reference, description, fund_accounts(name)")
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    const rows = (data ?? [])
      .map((r) => {
        const fund = r.fund_accounts as unknown as { name: string } | null;
        return {
          date: r.created_at ?? "",
          fund: fund?.name ?? "",
          type: r.transaction_type,
          direction: r.direction,
          amount: Number(r.amount ?? 0),
          reference: r.reference,
          description: r.description ?? "",
        };
      })
      .filter((r) => inDateRange(r.date, opts.startDate, opts.endDate));

    return {
      key: "fund",
      title: "Fund Report",
      columns: [
        { key: "date", label: "Date", format: "datetime" },
        { key: "fund", label: "Fund" },
        { key: "type", label: "Type" },
        { key: "direction", label: "Direction" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "reference", label: "Reference" },
        { key: "description", label: "Description" },
      ],
      rows,
      totals: {
        in: rows.reduce((s, r) => s + (r.direction === "IN" ? Number(r.amount) : 0), 0),
        out: rows.reduce((s, r) => s + (r.direction === "OUT" ? Number(r.amount) : 0), 0),
      },
    };
  }

  private async interestIncomeReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "interest-income", title: "Loan Interest Income", columns: [], rows: [], totals: {} };

    const { data } = await this.supabase
      .from("ledger_entries")
      .select(
        `
        credit,
        ledger_transactions!inner(reference, transaction_date, description, transaction_type),
        ledger_accounts!inner(code)
      `
      )
      .eq("ledger_accounts.code", "4000")
      .order("created_at", { ascending: false });

    const rows = (data ?? [])
      .filter((r) => Number(r.credit ?? 0) > 0)
      .map((r) => {
        const tx = r.ledger_transactions as unknown as {
          reference: string;
          transaction_date: string;
          description: string;
          transaction_type: string;
        };
        return {
          date: tx?.transaction_date ?? "",
          reference: tx?.reference ?? "",
          description: tx?.description ?? "",
          type: tx?.transaction_type ?? "",
          interest: Number(r.credit ?? 0),
        };
      })
      .filter((r) => inDateRange(r.date, opts.startDate, opts.endDate));

    return {
      key: "interest-income",
      title: "Loan Interest Income",
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "reference", label: "Reference" },
        { key: "description", label: "Description" },
        { key: "type", label: "Type" },
        { key: "interest", label: "Interest", format: "currency" },
      ],
      rows,
      totals: {
        interest: rows.reduce((s, r) => s + Number(r.interest), 0),
      },
    };
  }

  private async withdrawalReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "withdrawal", title: "Withdrawal Report", columns: [], rows: [], totals: {} };

    let query = this.supabase
      .from("withdrawal_requests")
      .select(
        `
        created_at,
        amount,
        fee,
        net_amount,
        status,
        reference,
        employees(employee_number, first_name, last_name, department, branch),
        bank_accounts(bank_name, account_number)
      `
      )
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    if (opts.status) query = query.eq("status", opts.status);

    const { data } = await query;

    const rows = (data ?? [])
      .map((r) => {
        const emp = r.employees as unknown as {
          employee_number: string;
          first_name: string;
          last_name: string;
          department: string | null;
          branch: string | null;
        } | null;
        const account = r.bank_accounts as unknown as { bank_name: string; account_number: string } | null;
        return {
          requestedAt: r.created_at ?? "",
          employeeNumber: emp?.employee_number ?? "",
          employeeName: emp ? fullName(emp.first_name, emp.last_name) : "",
          department: emp?.department ?? "",
          branch: emp?.branch ?? "",
          amount: Number(r.amount ?? 0),
          fee: Number(r.fee ?? 0),
          netAmount: Number(r.net_amount ?? 0),
          bank: account?.bank_name ?? "",
          reference: r.reference,
          status: r.status,
        };
      })
      .filter(employeeMatch(opts.department, opts.branch, opts.employee))
      .filter((r) => inDateRange(r.requestedAt, opts.startDate, opts.endDate));

    return {
      key: "withdrawal",
      title: "Withdrawal Report",
      columns: [
        { key: "requestedAt", label: "Requested", format: "datetime" },
        { key: "employeeNumber", label: "Employee #" },
        { key: "employeeName", label: "Name" },
        { key: "department", label: "Department" },
        { key: "branch", label: "Branch" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "fee", label: "Fee", format: "currency" },
        { key: "netAmount", label: "Net", format: "currency" },
        { key: "bank", label: "Bank" },
        { key: "reference", label: "Reference" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        amount: rows.reduce((s, r) => s + Number(r.amount), 0),
        netAmount: rows.reduce((s, r) => s + Number(r.netAmount), 0),
      },
    };
  }

  private async transactionReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "transaction", title: "Transaction Report", columns: [], rows: [], totals: {} };

    let query = this.supabase
      .from("ledger_transactions")
      .select("id, reference, description, transaction_date, transaction_type, status, created_at")
      .eq("organization_id", this.orgId)
      .order("transaction_date", { ascending: false });

    if (opts.status) query = query.eq("status", opts.status);

    const { data } = await query;

    const totals = new Map<string, { debit: number; credit: number }>();
    if ((data ?? []).length > 0) {
      const ids = (data ?? []).map((t) => t.id);
      const { data: entries } = await this.supabase
        .from("ledger_entries")
        .select("transaction_id, debit, credit")
        .in("transaction_id", ids as never[]);
      for (const e of entries ?? []) {
        const cur = totals.get(e.transaction_id) ?? { debit: 0, credit: 0 };
        cur.debit += Number(e.debit ?? 0);
        cur.credit += Number(e.credit ?? 0);
        totals.set(e.transaction_id, cur);
      }
    }

    const rows = (data ?? [])
      .map((r) => {
        const t = totals.get(r.id) ?? { debit: 0, credit: 0 };
        return {
          date: r.transaction_date ?? r.created_at ?? "",
          reference: r.reference,
          description: r.description ?? "",
          type: r.transaction_type,
          status: r.status,
          debit: Math.round(t.debit * 100) / 100,
          credit: Math.round(t.credit * 100) / 100,
        };
      })
      .filter((r) => inDateRange(r.date, opts.startDate, opts.endDate));

    return {
      key: "transaction",
      title: "Transaction Report",
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "reference", label: "Reference" },
        { key: "description", label: "Description" },
        { key: "type", label: "Type" },
        { key: "status", label: "Status" },
        { key: "debit", label: "Debit", format: "currency" },
        { key: "credit", label: "Credit", format: "currency" },
      ],
      rows,
      totals: {
        debit: rows.reduce((s, r) => s + Number(r.debit), 0),
        credit: rows.reduce((s, r) => s + Number(r.credit), 0),
      },
    };
  }

  private async auditReport(opts: ReportOptions): Promise<ReportData> {
    if (!this.orgId) return { key: "audit", title: "Audit Report", columns: [], rows: [], totals: {} };

    const { data } = await this.supabase
      .from("audit_logs")
      .select("created_at, action, entity_type, entity_id, ip_address, user_agent, users(email, full_name)")
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    const rows = (data ?? [])
      .map((r) => {
        const user = r.users as unknown as { email: string; full_name: string } | null;
        return {
          date: r.created_at ?? "",
          user: user ? (user.full_name || user.email) : "",
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id ?? "",
          ipAddress: r.ip_address ?? "",
        };
      })
      .filter((r) => inDateRange(r.date, opts.startDate, opts.endDate));

    return {
      key: "audit",
      title: "Audit Report",
      columns: [
        { key: "date", label: "Date", format: "datetime" },
        { key: "user", label: "User" },
        { key: "action", label: "Action" },
        { key: "entityType", label: "Entity" },
        { key: "entityId", label: "Entity ID" },
        { key: "ipAddress", label: "IP Address" },
      ],
      rows,
      totals: {},
    };
  }

  async runReport(key: string, opts: ReportOptions = {}): Promise<ReportData> {
    switch (key) {
      case "employee":
        return this.employeeReport(opts);
      case "thrift":
        return this.thriftReport(opts);
      case "thrift-interest":
        return this.thriftInterestReport(opts);
      case "loan-applications":
        return this.loanApplicationsReport(opts);
      case "loan-portfolio":
        return this.loanPortfolioReport(opts);
      case "repayments":
        return this.repaymentReport(opts);
      case "default":
        return this.defaultReport(opts);
      case "fund":
        return this.fundReport(opts);
      case "interest-income":
        return this.interestIncomeReport(opts);
      case "withdrawal":
        return this.withdrawalReport(opts);
      case "transaction":
        return this.transactionReport(opts);
      case "audit":
        return this.auditReport(opts);
      default:
        return { key, title: key, columns: [], rows: [], totals: {} };
    }
  }
}
