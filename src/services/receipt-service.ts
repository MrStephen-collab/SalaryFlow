import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RECEIPT_TYPE_LABELS,
  createReceiptCode,
  isReceiptType,
  readReceiptCode,
  receiptNumber,
  type ReceiptType,
} from "@/lib/receipt-code";

type AdminClient = ReturnType<typeof createAdminClient>;

type Embedded<T> = T | T[] | null;

function unwrap<T>(value: Embedded<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface ReceiptEmployee {
  employee_number: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ReceiptOrganization {
  name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  currency: string | null;
}

export interface ReceiptView {
  type: ReceiptType;
  typeLabel: string;
  id: string;
  receiptNumber: string;
  reference: string;
  status: string;
  issuedAt: string;
  amount: number;
  currency: string;
  description: string;
  employee: {
    name: string;
    number: string;
  };
  organization: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  details: { label: string; value: string }[];
  verificationCode: string;
}

export interface ReceiptVerification {
  receiptNumber: string;
  typeLabel: string;
  organizationName: string;
  amount: number;
  currency: string;
  issuedAt: string;
  status: string;
  reference: string;
  employeeMasked: string;
}

interface RawReceipt {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  amount: number;
  status: string;
  reference: string;
  issuedAt: string;
  description: string;
  details: { label: string; value: string }[];
}

function money(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function maskAccount(accountNumber: string | null | undefined) {
  if (!accountNumber) return "—";
  return `****${accountNumber.slice(-4)}`;
}

function maskName(firstName: string | null, lastName: string | null) {
  const first = firstName ? `${firstName.charAt(0)}***` : "***";
  const last = lastName ? `${lastName.charAt(0)}***` : "";
  return `${first} ${last}`.trim();
}

function fallbackReference(prefix: string, id: string) {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

async function fetchRepayment(
  admin: AdminClient,
  id: string
): Promise<RawReceipt | null> {
  const { data } = await admin
    .from("loan_repayments")
    .select(
      `
      id,
      amount,
      payment_method,
      reference_number,
      notes,
      recorded_at,
      created_at,
      loan_applications!inner(
        id,
        organization_id,
        employee_id,
        employees:employee_id(employee_number, first_name, last_name),
        loan_products:loan_product_id(name)
      ),
      loan_schedules:schedule_id(month_number, due_date)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const loan = unwrap(
    data.loan_applications as unknown as {
      id: string;
      organization_id: string;
      employee_id: string;
      employees: Embedded<ReceiptEmployee>;
      loan_products: Embedded<{ name: string | null }>;
    }
  );
  const employee = unwrap(loan?.employees);
  const product = unwrap(loan?.loan_products);
  const schedule = unwrap(
    data.loan_schedules as unknown as {
      month_number: number;
      due_date: string | null;
    }
  );

  const amount = Number(data.amount) || 0;
  const details = [
    { label: "Payment method", value: humanize(data.payment_method) },
    { label: "Loan product", value: product?.name ?? "Loan" },
  ];

  if (schedule?.month_number) {
    details.push({
      label: "Installment",
      value: `#${schedule.month_number}${
        schedule.due_date ? ` (due ${dateOnly(schedule.due_date)})` : ""
      }`,
    });
  }

  if (data.notes) {
    details.push({ label: "Notes", value: data.notes });
  }

  return {
    id: data.id,
    organizationId: loan?.organization_id ?? "",
    employeeId: loan?.employee_id ?? "",
    employeeName: employee
      ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
      : "Employee",
    employeeNumber: employee?.employee_number ?? "",
    amount,
    status: "RECORDED",
    reference:
      data.reference_number ?? fallbackReference("REP", data.id),
    issuedAt: data.recorded_at ?? data.created_at,
    description: product?.name
      ? `Loan repayment — ${product.name}`
      : "Loan repayment",
    details,
  };
}

async function fetchDeduction(
  admin: AdminClient,
  id: string
): Promise<RawReceipt | null> {
  const { data } = await admin
    .from("deduction_records")
    .select(
      `
      id,
      organization_id,
      employee_id,
      expected_amount,
      actual_amount,
      shortfall,
      status,
      reference,
      notes,
      processed_at,
      created_at,
      employees:employee_id(employee_number, first_name, last_name),
      salary_periods:salary_period_id(name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const employee = unwrap(
    data.employees as unknown as Embedded<ReceiptEmployee>
  );
  const period = unwrap(
    data.salary_periods as unknown as Embedded<{ name: string | null }>
  );

  const details = [
    {
      label: "Salary period",
      value: period?.name ?? "Payroll deduction",
    },
    { label: "Expected amount", value: money(Number(data.expected_amount) || 0) },
  ];

  const shortfall = Number(data.shortfall) || 0;
  if (shortfall > 0) {
    details.push({ label: "Shortfall", value: money(shortfall) });
  }

  if (data.notes) {
    details.push({ label: "Notes", value: data.notes });
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    employeeId: data.employee_id,
    employeeName: employee
      ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
      : "Employee",
    employeeNumber: employee?.employee_number ?? "",
    amount: Number(data.actual_amount) || 0,
    status: data.status,
    reference: data.reference ?? fallbackReference("DED", data.id),
    issuedAt: data.processed_at ?? data.created_at,
    description: period?.name
      ? `Salary deduction — ${period.name}`
      : "Salary deduction",
    details,
  };
}

async function fetchWithdrawal(
  admin: AdminClient,
  id: string
): Promise<RawReceipt | null> {
  const { data } = await admin
    .from("withdrawal_requests")
    .select(
      `
      id,
      organization_id,
      employee_id,
      amount,
      fee,
      net_amount,
      status,
      reference,
      provider_reference,
      failure_reason,
      paid_at,
      processed_at,
      created_at,
      employees(employee_number, first_name, last_name),
      bank_accounts(bank_name, account_number, account_name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const employee = unwrap(
    data.employees as unknown as Embedded<ReceiptEmployee>
  );
  const account = unwrap(
    data.bank_accounts as unknown as Embedded<{
      bank_name: string | null;
      account_number: string | null;
      account_name: string | null;
    }>
  );

  const details = [
    { label: "Amount requested", value: money(Number(data.amount) || 0) },
    { label: "Fee", value: money(Number(data.fee) || 0) },
    {
      label: "Bank",
      value: account?.bank_name ?? "—",
    },
    {
      label: "Account",
      value: `${maskAccount(account?.account_number)} · ${
        account?.account_name ?? "—"
      }`,
    },
  ];

  if (data.provider_reference) {
    details.push({
      label: "Provider reference",
      value: data.provider_reference,
    });
  }

  if (data.failure_reason) {
    details.push({ label: "Failure reason", value: data.failure_reason });
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    employeeId: data.employee_id,
    employeeName: employee
      ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
      : "Employee",
    employeeNumber: employee?.employee_number ?? "",
    amount: Number(data.net_amount) || 0,
    status: data.status,
    reference: data.reference ?? fallbackReference("WDR", data.id),
    issuedAt: data.paid_at ?? data.processed_at ?? data.created_at,
    description: account?.bank_name
      ? `Withdrawal payout — ${account.bank_name}`
      : "Withdrawal payout",
    details,
  };
}

async function fetchRawReceipt(
  admin: AdminClient,
  type: ReceiptType,
  id: string
): Promise<RawReceipt | null> {
  switch (type) {
    case "repayment":
      return fetchRepayment(admin, id);
    case "deduction":
      return fetchDeduction(admin, id);
    case "withdrawal":
      return fetchWithdrawal(admin, id);
  }
}

async function fetchOrganization(
  admin: AdminClient,
  organizationId: string
): Promise<ReceiptOrganization | null> {
  if (!organizationId) return null;

  const { data } = await admin
    .from("organizations")
    .select(
      "name, logo_url, primary_color, email, phone, address, state, currency"
    )
    .eq("id", organizationId)
    .maybeSingle();

  return (data as ReceiptOrganization | null) ?? null;
}

function buildView(
  type: ReceiptType,
  raw: RawReceipt,
  organization: ReceiptOrganization | null
): ReceiptView {
  const issuedAt = raw.issuedAt || new Date().toISOString();
  const addressParts = [organization?.address, organization?.state].filter(
    Boolean
  );

  return {
    type,
    typeLabel: RECEIPT_TYPE_LABELS[type],
    id: raw.id,
    receiptNumber: receiptNumber(type, raw.id, issuedAt),
    reference: raw.reference,
    status: raw.status,
    issuedAt,
    amount: raw.amount,
    currency: organization?.currency ?? "NGN",
    description: raw.description,
    employee: {
      name: raw.employeeName,
      number: raw.employeeNumber,
    },
    organization: {
      name: organization?.name ?? "Organization",
      logoUrl: organization?.logo_url ?? null,
      primaryColor: organization?.primary_color ?? null,
      email: organization?.email ?? null,
      phone: organization?.phone ?? null,
      address: addressParts.join(", ") || null,
    },
    details: raw.details,
    verificationCode: createReceiptCode(type, raw.id),
  };
}

export class ReceiptService {
  /**
   * Load a receipt for the signed-in user. Employees can only load their own
   * receipts; organization staff can load any receipt inside their tenant.
   */
  static async getReceipt(type: string, id: string) {
    if (!isReceiptType(type)) return { error: "NOT_FOUND" as const };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "UNAUTHORIZED" as const };

    const admin = createAdminClient();

    const [profileResult, employeeResult, raw] = await Promise.all([
      admin
        .from("user_profiles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
      fetchRawReceipt(admin, type, id),
    ]);

    if (!raw) return { error: "NOT_FOUND" as const };

    const profile = profileResult.data;
    const isOwner = employeeResult.data?.id === raw.employeeId;
    const isTenantStaff =
      Boolean(profile?.organization_id) &&
      profile?.organization_id === raw.organizationId &&
      profile?.role !== "EMPLOYEE";

    if (!isOwner && !isTenantStaff) {
      return { error: "FORBIDDEN" as const };
    }

    const organization = await fetchOrganization(admin, raw.organizationId);

    return { receipt: buildView(type, raw, organization) };
  }

  /**
   * Public receipt verification. Returns only non-sensitive fields.
   */
  static async verifyReceipt(
    code: string
  ): Promise<ReceiptVerification | null> {
    const decoded = readReceiptCode(code);
    if (!decoded) return null;

    // Re-generate the code to guard against any parsing edge cases.
    if (createReceiptCode(decoded.type, decoded.id) !== code) return null;

    const admin = createAdminClient();
    const raw = await fetchRawReceipt(admin, decoded.type, decoded.id);
    if (!raw) return null;

    const organization = await fetchOrganization(admin, raw.organizationId);
    const view = buildView(decoded.type, raw, organization);
    const [firstName, ...rest] = raw.employeeName.split(" ");

    return {
      receiptNumber: view.receiptNumber,
      typeLabel: view.typeLabel,
      organizationName: view.organization.name,
      amount: view.amount,
      currency: view.currency,
      issuedAt: view.issuedAt,
      status: view.status,
      reference: view.reference,
      employeeMasked: maskName(firstName ?? null, rest.join(" ") || null),
    };
  }
}

export const getReceipt = reactCache(
  async (type: string, id: string) => ReceiptService.getReceipt(type, id)
);
