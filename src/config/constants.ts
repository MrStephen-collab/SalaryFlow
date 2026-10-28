export const APP_NAME = "SalaryFlow";
export const APP_DESCRIPTION =
  "Salary-based employee finance SaaS platform";

export const CURRENCY = {
  code: "NGN",
  symbol: "\u20A6",
  locale: "en-NG",
} as const;

export const DATE_FORMAT = "DD/MM/YYYY";
export const TIMEZONE = "Africa/Lagos";

export const ORGANIZATION_TYPES = [
  "Company",
  "Hotel",
  "School",
  "Hospital",
  "Factory",
  "Church",
  "NGO",
  "Cooperative",
  "Association",
  "Other",
] as const;

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Intern",
  "Casual",
] as const;

export const EMPLOYMENT_STATUSES = [
  "Active",
  "Suspended",
  "Terminated",
  "Resigned",
  "On Leave",
] as const;

export const LOAN_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ELIGIBILITY_FAILED",
  "APPROVED",
  "REJECTED",
  "READY_FOR_DISBURSEMENT",
  "DISBURSED",
  "ACTIVE",
  "COMPLETED",
  "DEFAULTED",
  "CANCELLED",
  "RESTRUCTURED",
] as const;

export const INTEREST_METHODS = ["FLAT", "REDUCING_BALANCE", "AMORTIZED"] as const;

export const SALARY_PERIOD_STATUSES = [
  "DRAFT",
  "PROCESSING",
  "APPROVED",
  "PAID",
  "CLOSED",
] as const;

export const REPAYMENT_STATUSES = [
  "UPCOMING",
  "DUE",
  "PAID",
  "LATE",
  "WAIVED",
  "REVERSED",
] as const;

export const USER_ROLES = [
  "SUPER_ADMIN",
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "FINANCE_MANAGER",
  "HR_MANAGER",
  "LOAN_OFFICER",
  "ACCOUNTANT",
  "PAYROLL_OFFICER",
  "AUDITOR",
  "EMPLOYEE",
] as const;
