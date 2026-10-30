import { createClient } from "@/lib/supabase/server";
import type { CreateLoanProductValues } from "@/schemas/loan";
import { LoanCalculationService } from "./loan-calculation-service";
import type { InterestMethod } from "./loan-calculation-service";
import { recordAudit } from "./audit-service";

export class LoanService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private orgId: string | null = null;
  private userId: string | null = null;

  private constructor(
    supabase: Awaited<ReturnType<typeof createClient>>
  ) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let orgId: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      orgId = profile?.organization_id ?? null;
    }

    const service = new LoanService(supabase);
    service.orgId = orgId;
    service.userId = user?.id ?? null;
    return service;
  }

  private audit(
    action: string,
    entityType: string,
    entityId: string,
    before: Record<string, unknown> | null = null,
    after: Record<string, unknown> | null = null
  ) {
    return recordAudit({
      organizationId: this.orgId,
      userId: this.userId,
      action,
      entityType,
      entityId,
      before,
      after,
    });
  }

  async listProducts() {
    if (!this.orgId) return [];

    const { data } = await this.supabase
      .from("loan_products")
      .select("*")
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    return data ?? [];
  }

  async getProduct(productId: string) {
    if (!this.orgId) return null;

    const { data } = await this.supabase
      .from("loan_products")
      .select("*")
      .eq("id", productId)
      .eq("organization_id", this.orgId)
      .single();

    return data;
  }

  async createProduct(values: CreateLoanProductValues) {
    if (!this.orgId) return { error: "No organization found" };

    const { data: product, error } = await this.supabase
      .from("loan_products")
      .insert({
        organization_id: this.orgId,
        name: values.name,
        description: values.description ?? null,
        minimum_amount: values.minimumAmount,
        maximum_amount: values.maximumAmount,
        interest_rate: values.interestRate,
        interest_method: values.interestMethod,
        duration_months: values.durationMonths,
        repayment_frequency: values.repaymentFrequency,
        processing_fee: values.processingFee ?? 0,
        insurance_fee: values.insuranceFee ?? 0,
        maximum_salary_deduction_percentage:
          values.maximumSalaryDeductionPercentage,
        minimum_salary: values.minimumSalary ?? 0,
        minimum_employment_period_months:
          values.minimumEmploymentPeriodMonths ?? 0,
        guarantor_required: values.guarantorRequired ?? false,
        collateral_required: values.collateralRequired ?? false,
      })
      .select("id, name")
      .single();

    if (error) {
      return { error: error.message };
    }

    await this.audit("loan.product_created", "loan_product", product.id, null, {
      name: product.name,
      interestRate: values.interestRate,
      interestMethod: values.interestMethod,
      durationMonths: values.durationMonths,
    });

    return { success: "Loan product created" };
  }

  async updateProduct(
    productId: string,
    values: Partial<CreateLoanProductValues>
  ) {
    if (!this.orgId) return { error: "No organization found" };

    const updateData: Record<string, unknown> = {};
    if (values.name !== undefined) updateData.name = values.name;
    if (values.description !== undefined)
      updateData.description = values.description;
    if (values.minimumAmount !== undefined)
      updateData.minimum_amount = values.minimumAmount;
    if (values.maximumAmount !== undefined)
      updateData.maximum_amount = values.maximumAmount;
    if (values.interestRate !== undefined)
      updateData.interest_rate = values.interestRate;
    if (values.interestMethod !== undefined)
      updateData.interest_method = values.interestMethod;
    if (values.durationMonths !== undefined)
      updateData.duration_months = values.durationMonths;
    if (values.repaymentFrequency !== undefined)
      updateData.repayment_frequency = values.repaymentFrequency;
    if (values.processingFee !== undefined)
      updateData.processing_fee = values.processingFee;
    if (values.insuranceFee !== undefined)
      updateData.insurance_fee = values.insuranceFee;
    if (values.maximumSalaryDeductionPercentage !== undefined)
      updateData.maximum_salary_deduction_percentage =
        values.maximumSalaryDeductionPercentage;
    if (values.minimumSalary !== undefined)
      updateData.minimum_salary = values.minimumSalary;
    if (values.minimumEmploymentPeriodMonths !== undefined)
      updateData.minimum_employment_period_months =
        values.minimumEmploymentPeriodMonths;
    if (values.guarantorRequired !== undefined)
      updateData.guarantor_required = values.guarantorRequired;
    if (values.collateralRequired !== undefined)
      updateData.collateral_required = values.collateralRequired;

    const { error } = await this.supabase
      .from("loan_products")
      .update(updateData)
      .eq("id", productId)
      .eq("organization_id", this.orgId);

    if (error) {
      return { error: error.message };
    }

    await this.audit("loan.product_updated", "loan_product", productId, null, updateData);

    return { success: "Loan product updated" };
  }

  async toggleProductActive(productId: string, active: boolean) {
    if (!this.orgId) return { error: "No organization found" };

    const { error } = await this.supabase
      .from("loan_products")
      .update({ active })
      .eq("id", productId)
      .eq("organization_id", this.orgId);

    if (error) {
      return { error: error.message };
    }

    await this.audit(
      active ? "loan.product_activated" : "loan.product_deactivated",
      "loan_product",
      productId,
      { active: !active },
      { active }
    );

    return { success: active ? "Product activated" : "Product deactivated" };
  }

  async deleteProduct(productId: string) {
    if (!this.orgId) return { error: "No organization found" };

    const { error } = await this.supabase
      .from("loan_products")
      .delete()
      .eq("id", productId)
      .eq("organization_id", this.orgId);

    if (error) {
      return { error: error.message };
    }

    await this.audit("loan.product_deleted", "loan_product", productId);

    return { success: "Loan product deleted" };
  }

  async listApplications(status?: string) {
    if (!this.orgId) return [];

    let query = this.supabase
      .from("loan_applications")
      .select(
        `
        *,
        employees:employee_id(employee_number, first_name, last_name),
        loan_products:loan_product_id(name, interest_method)
      `
      )
      .eq("organization_id", this.orgId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data } = await query;

    return (data ?? []).map((row) => {
      const emp = row.employees as unknown as
        | {
            employee_number: string;
            first_name: string;
            last_name: string;
          }
        | null;
      const product = row.loan_products as unknown as
        | { name: string; interest_method: string }
        | null;

      return {
        ...row,
        employeeName: emp
          ? `${emp.first_name} ${emp.last_name}`
          : "Unknown",
        employeeNumber: emp?.employee_number ?? "",
        productName: product?.name ?? "Unknown",
      };
    });
  }

  async getApplication(applicationId: string) {
    if (!this.orgId) return null;

    const { data } = await this.supabase
      .from("loan_applications")
      .select(
        `
        *,
        employees:employee_id(employee_number, first_name, last_name, department, salary, date_joined),
        loan_products:loan_product_id(name, interest_method, interest_rate, duration_months, processing_fee, insurance_fee)
      `
      )
      .eq("id", applicationId)
      .eq("organization_id", this.orgId)
      .single();

    if (!data) return null;

    const emp = data.employees as unknown as
      | {
          employee_number: string;
          first_name: string;
          last_name: string;
          department: string | null;
          salary: number;
          date_joined: string;
        }
      | null;
    const product = data.loan_products as unknown as
      | {
          name: string;
          interest_method: string;
          interest_rate: number;
          duration_months: number;
          processing_fee: number;
          insurance_fee: number;
        }
      | null;

    return {
      ...data,
      employeeName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
      employeeNumber: emp?.employee_number ?? "",
      employeeDepartment: emp?.department ?? "",
      employeeSalary: emp?.salary ?? 0,
      productName: product?.name ?? "Unknown",
    };
  }

  async applyForLoan(
    employeeId: string,
    loanProductId: string,
    amount: number,
    durationMonths: number,
    purpose?: string
  ) {
    if (!this.orgId) return { error: "No organization found" };

    const { data: product } = await this.supabase
      .from("loan_products")
      .select("*")
      .eq("id", loanProductId)
      .eq("organization_id", this.orgId)
      .single();

    if (!product) return { error: "Loan product not found" };
    if (!product.active) return { error: "Loan product is not active" };

    const calculation = LoanCalculationService.calculate({
      principal: amount,
      annualInterestRate: product.interest_rate,
      interestMethod: product.interest_method as InterestMethod,
      durationMonths,
      processingFee: product.processing_fee,
      insuranceFee: product.insurance_fee,
    });

    const { data: application, error } = await this.supabase
      .from("loan_applications")
      .insert({
        organization_id: this.orgId,
        employee_id: employeeId,
        loan_product_id: loanProductId,
        amount,
        duration_months: durationMonths,
        interest_rate: product.interest_rate,
        interest_method: product.interest_method,
        total_interest: calculation.totalInterest,
        total_repayment: calculation.totalRepayment,
        monthly_deduction: calculation.monthlyPayment,
        purpose: purpose ?? null,
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    await this.audit("loan.application_submitted", "loan_application", application.id, null, {
      employeeId,
      productName: product.name,
      amount,
      durationMonths,
      monthlyDeduction: calculation.monthlyPayment,
      status: "SUBMITTED",
    });

    return { success: "Loan application submitted" };
  }

  async approveApplication(applicationId: string, notes?: string) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (profile?.role !== "ORGANIZATION_OWNER") {
      return { error: "Only the chairman can approve loans" };
    }

    const { data: existing } = await this.supabase
      .from("loan_applications")
      .select("status")
      .eq("id", applicationId)
      .eq("organization_id", this.orgId)
      .single();

    if (!existing) return { error: "Application not found" };
    if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_REVIEW") {
      return { error: `Cannot approve application in ${existing.status} status` };
    }

    const { error } = await this.supabase
      .from("loan_applications")
      .update({
        status: "APPROVED",
        approved_at: new Date().toISOString(),
        approved_by: this.userId,
        notes: notes ?? null,
      })
      .eq("id", applicationId)
      .eq("organization_id", this.orgId);

    if (error) return { error: error.message };

    await this.audit(
      "loan.approved",
      "loan_application",
      applicationId,
      { status: existing.status },
      { status: "APPROVED", notes: notes ?? null }
    );

    return { success: "Application approved" };
  }

  async rejectApplication(applicationId: string, reason: string) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: existing } = await this.supabase
      .from("loan_applications")
      .select("status")
      .eq("id", applicationId)
      .eq("organization_id", this.orgId)
      .single();

    if (!existing) return { error: "Application not found" };
    if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_REVIEW") {
      return { error: `Cannot reject application in ${existing.status} status` };
    }

    if (!reason) return { error: "Rejection reason is required" };

    const { error } = await this.supabase
      .from("loan_applications")
      .update({
        status: "REJECTED",
        rejected_at: new Date().toISOString(),
        rejected_by: this.userId,
        rejection_reason: reason,
      })
      .eq("id", applicationId)
      .eq("organization_id", this.orgId);

    if (error) return { error: error.message };

    await this.audit(
      "loan.rejected",
      "loan_application",
      applicationId,
      { status: existing.status },
      { status: "REJECTED", reason }
    );

    return { success: "Application rejected" };
  }

  async disburseLoan(applicationId: string) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: approver } = await this.supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (approver?.role !== "ORGANIZATION_OWNER") {
      return { error: "Only the chairman can disburse loans" };
    }

    const { data: existing } = await this.supabase
      .from("loan_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("organization_id", this.orgId)
      .single();

    if (!existing) return { error: "Application not found" };
    if (existing.status !== "APPROVED" && existing.status !== "READY_FOR_DISBURSEMENT") {
      return { error: `Cannot disburse loan in ${existing.status} status` };
    }

    const { data: product } = await this.supabase
      .from("loan_products")
      .select("*")
      .eq("id", existing.loan_product_id)
      .single();

    if (!product) return { error: "Loan product not found" };

    const calculation = LoanCalculationService.calculate({
      principal: existing.amount,
      annualInterestRate: product.interest_rate,
      interestMethod: product.interest_method as InterestMethod,
      durationMonths: existing.duration_months,
      processingFee: product.processing_fee,
      insuranceFee: product.insurance_fee,
    });

    const scheduleInserts = calculation.schedule.map((entry) => ({
      loan_application_id: applicationId,
      month_number: entry.month,
      opening_balance: entry.openingBalance,
      principal_payment: entry.principalPayment,
      interest_payment: entry.interestPayment,
      total_payment: entry.totalPayment,
      closing_balance: entry.closingBalance,
      status: entry.month === 1 ? "DUE" : "UPCOMING",
      due_date: new Date(
        Date.now() + entry.month * 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0],
    }));

    const { error: scheduleError } = await this.supabase
      .from("loan_schedules")
      .insert(scheduleInserts);

    if (scheduleError) return { error: scheduleError.message };

    const { error } = await this.supabase
      .from("loan_applications")
      .update({
        status: "ACTIVE",
      })
      .eq("id", applicationId)
      .eq("organization_id", this.orgId);

    if (error) return { error: error.message };

    // Post accounting entries
    const ledger = await (await import("./ledger-service")).LedgerService.create();
    const ledgerResult = await ledger.postLoanDisbursement(
      existing.employee_id,
      applicationId,
      existing.amount
    );
    if (ledgerResult.error) {
      return { error: `Loan disbursed but ledger error: ${ledgerResult.error}` };
    }

    // Record fund movement against the first active fund account (if any)
    const fund = await (await import("./fund-service")).FundService.create();
    const fundAccounts = await fund.listFundAccounts();
    const primaryFund = fundAccounts.find((f) => f.status === "ACTIVE");
    if (primaryFund) {
      await fund.recordMovement(
        primaryFund.id,
        "DISBURSEMENT",
        existing.amount,
        "OUT",
        `Loan disbursement #${applicationId.slice(0, 8)}`,
        applicationId
      );
    }

    await this.audit(
      "loan.disbursed",
      "loan_application",
      applicationId,
      { status: existing.status },
      {
        status: "ACTIVE",
        amount: Number(existing.amount),
        employeeId: existing.employee_id,
        installments: calculation.schedule.length,
        monthlyDeduction: calculation.monthlyPayment,
      }
    );

    return { success: "Loan disbursed and repayment schedule created" };
  }
  async getSchedule(applicationId: string) {
    if (!this.orgId) return [];

    const { data } = await this.supabase
      .from("loan_schedules")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("month_number", { ascending: true });

    return data ?? [];
  }

  async getCurrentEmployee() {
    if (!this.userId) return null;

    const { data } = await this.supabase
      .from("employees")
      .select("id, salary, first_name, last_name, employee_number")
      .eq("user_id", this.userId)
      .maybeSingle();

    return data;
  }

  async recordRepayment(
    applicationId: string,
    scheduleId: string,
    amount: number,
    paymentMethod: string = "SALARY_DEDUCTION"
  ) {
    if (!this.orgId || !this.userId) return { error: "Unauthorized" };

    const { data: application } = await this.supabase
      .from("loan_applications")
      .select("employee_id")
      .eq("id", applicationId)
      .eq("organization_id", this.orgId)
      .single();

    if (!application) return { error: "Loan application not found" };

    const { data: schedule } = await this.supabase
      .from("loan_schedules")
      .select("*")
      .eq("id", scheduleId)
      .eq("loan_application_id", applicationId)
      .single();

    if (!schedule) return { error: "Schedule entry not found" };
    if (schedule.status === "PAID") return { error: "This installment is already paid" };

    const newPaidAmount = Number(schedule.paid_amount) + amount;
    const totalDue = Number(schedule.total_payment);
    const newStatus = newPaidAmount >= totalDue ? "PAID" : "LATE";

    const { error: scheduleError } = await this.supabase
      .from("loan_schedules")
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        paid_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);

    if (scheduleError) return { error: scheduleError.message };

    const ref = `REP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { data: repayment, error: repaymentError } = await this.supabase
      .from("loan_repayments")
      .insert({
        loan_application_id: applicationId,
        schedule_id: scheduleId,
        amount,
        payment_method: paymentMethod,
        reference_number: ref,
        recorded_by: this.userId,
      })
      .select("id")
      .single();

    if (repaymentError) return { error: repaymentError.message };

    // Post accounting entries (apportion: pay interest first, rest to principal)
    const interestPortion = Math.min(Number(schedule.interest_payment) || 0, amount);
    const principalPortion = Math.max(0, amount - interestPortion);
    const ledger = await (await import("./ledger-service")).LedgerService.create();
    const ledgerResult = await ledger.postLoanRepayment(
      application.employee_id,
      applicationId,
      amount,
      principalPortion,
      interestPortion
    );
    if (ledgerResult.error) {
      return { error: `Repayment recorded but ledger error: ${ledgerResult.error}` };
    }

    // Record fund movement
    const fund = await (await import("./fund-service")).FundService.create();
    const fundAccounts = await fund.listFundAccounts();
    const primaryFund = fundAccounts.find((f) => f.status === "ACTIVE");
    if (primaryFund) {
      await fund.recordMovement(
        primaryFund.id,
        "REPAYMENT",
        amount,
        "IN",
        `Loan repayment #${applicationId.slice(0, 8)}`,
        applicationId
      );
    }

    const { data: allSchedule } = await this.supabase
      .from("loan_schedules")
      .select("status")
      .eq("loan_application_id", applicationId);

    const allPaid = allSchedule?.every((s) => s.status === "PAID");
    if (allPaid) {
      await this.supabase
        .from("loan_applications")
        .update({ status: "COMPLETED" })
        .eq("id", applicationId)
        .eq("organization_id", this.orgId);

      await this.audit(
        "loan.completed",
        "loan_application",
        applicationId,
        { status: "ACTIVE" },
        { status: "COMPLETED" }
      );
    }

    await this.audit(
      "loan.repayment_recorded",
      "loan_repayment",
      repayment.id,
      { schedulePaid: Number(schedule.paid_amount) || 0, scheduleStatus: schedule.status },
      {
        amount,
        paymentMethod,
        reference: ref,
        applicationId,
        scheduleId,
        schedulePaid: newPaidAmount,
        scheduleStatus: newStatus,
        loanCompleted: Boolean(allPaid),
      }
    );

    return { success: "Repayment recorded", reference: ref };
  }

  /**
   * List repayment records for the organization, enriched with the
   * employee and loan product details.
   */
  async listRepayments(paymentMethod?: string, limit = 100) {
    if (!this.orgId) return [];

    let query = this.supabase
      .from("loan_repayments")
      .select(
        `
        *,
        employees:loan_applications!inner(
          employee_id(
            employee_number,
            first_name,
            last_name
          ),
          loan_products:loan_product_id(name),
          amount,
          status
        )
      `
      )
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    const { data } = await query;

    return (data ?? []).map((row) => {
      const loan = row.employees as unknown as
        | {
            employee_id: {
              employee_number: string;
              first_name: string;
              last_name: string;
            } | null;
            loan_products: { name: string } | null;
            amount: number;
            status: string;
          }
        | null;
      const emp = loan?.employee_id ?? null;

      return {
        ...row,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
        employeeNumber: emp?.employee_number ?? "",
        productName: loan?.loan_products?.name ?? "Unknown",
        loanAmount: loan?.amount ?? 0,
        loanStatus: loan?.status ?? "",
      };
    });
  }

  /**
   * List outstanding (not yet paid) repayment installments across active
   * loans, enriched with employee and product details.
   */
  async listOutstandingSchedules(statuses?: string[], limit = 100) {
    if (!this.orgId) return [];

    const activeStatuses = statuses ?? ["UPCOMING", "DUE", "LATE"];

    const query = this.supabase
      .from("loan_schedules")
      .select(
        `
        *,
        loan_applications!inner(
          employee_id(
            employee_number,
            first_name,
            last_name
          ),
          loan_products:loan_product_id(name),
          amount,
          monthly_deduction,
          status
        )
      `
      )
      .eq("loan_applications.organization_id", this.orgId)
      .in("loan_applications.status", ["ACTIVE"])
      .in("status", activeStatuses)
      .order("month_number", { ascending: true })
      .limit(limit);

    const { data } = await query;

    return (data ?? []).map((row) => {
      const loan = row.loan_applications as unknown as
        | {
            employee_id: {
              employee_number: string;
              first_name: string;
              last_name: string;
            } | null;
            loan_products: { name: string } | null;
            amount: number;
            monthly_deduction: number;
            status: string;
          }
        | null;
      const emp = loan?.employee_id ?? null;

      return {
        ...row,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
        employeeNumber: emp?.employee_number ?? "",
        productName: loan?.loan_products?.name ?? "Unknown",
        loanAmount: loan?.amount ?? 0,
        loanApplicationStatus: loan?.status ?? "",
        loanApplicationId: row.loan_application_id,
      };
    });
  }
}
