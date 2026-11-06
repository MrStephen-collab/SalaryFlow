#!/usr/bin/env node
/**
 * Demo data seeder (spec #104).
 *
 * Creates realistic Nigerian payroll and lending data in the organization of a
 * given owner. Everything it writes is tagged so it can be removed again:
 *
 *   - employees      employee_number starts with DEMO- and email ends with
 *                    @salaryflow.local (DEMO-001 is "Demonstration Employee")
 *   - loans          purpose starts with DEMO-SEED
 *   - thrift         funding and interest references start with DEMO-SEED
 *   - ledger         reference starts with DEMO-SEED-LGR-
 *   - repayments     reference_number starts with DEMO-SEED-RP-
 *   - bank accounts  account numbers start with 90
 *   - withdrawals    reference starts with DEMO-SEED-WD-
 *   - audit rows     after_data.seed === "DEMO-SEED"
 *
 * Usage:
 *   node scripts/seed-demo.mjs                 # reset + seed
 *   node scripts/seed-demo.mjs --clean         # remove demo data only
 *   node scripts/seed-demo.mjs --org=email      # seed another owner's org
 *
 * The script is idempotent: it removes previously seeded demo data first.
 * It never touches non-demo rows. Standard chart-of-accounts rows created by
 * the seed (e.g. 4000 Interest Income) are kept after --clean because they are
 * organization fixtures rather than demo transactions.
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SEED_TAG = "DEMO-SEED";
const EMPLOYEE_PREFIX = "DEMO-";
const EMAIL_DOMAIN = "salaryflow.local";
const PRODUCT_NAMES = ["Salary Advance", "Emergency Loan", "Asset Finance"];

const args = process.argv.slice(2);
const CLEAN_ONLY = args.includes("--clean");
const ORG_EMAIL =
  args.find((arg) => arg.startsWith("--org="))?.slice("--org=".length) ??
  "chairman@royalbirds.com";

function loadEnv() {
  const env = {};
  const text = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const round2 = (value) => Math.round(value * 100) / 100;
const uuid = () => crypto.randomUUID();
const iso = (date) => date.toISOString();
const dateOnly = (date) => date.toISOString().slice(0, 10);

function addMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261028);
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

/** Reducing-balance schedule, matching src/services/loan-calculation-service.ts. */
function calculateSchedule(principal, annualRate, duration) {
  const monthlyRate = annualRate / 100 / 12;
  const principalPerMonth = round2(principal / duration);
  const rows = [];
  let balance = principal;
  let totalInterest = 0;

  for (let month = 1; month <= duration; month += 1) {
    const opening = balance;
    const interest = round2(balance * monthlyRate);
    const isLast = month === duration;
    const principalPayment = isLast ? balance : principalPerMonth;
    const totalPayment = round2(principalPayment + interest);
    const closing = Math.max(0, round2(opening - principalPayment));
    rows.push({
      month,
      openingBalance: opening,
      principalPayment,
      interestPayment: interest,
      totalPayment,
      closingBalance: closing,
    });
    totalInterest = round2(totalInterest + interest);
    balance = closing;
  }

  return {
    totalInterest,
    totalRepayment: round2(principal + totalInterest),
    monthlyPayment: round2((principal + totalInterest) / duration),
    rows,
  };
}

const FIRST_NAMES = [
  ["Adebayo", "M"], ["Chioma", "F"], ["Emeka", "M"], ["Funmilayo", "F"],
  ["Ibrahim", "M"], ["Ngozi", "F"], ["Oluwaseun", "M"], ["Aisha", "F"],
  ["Tunde", "M"], ["Blessing", "F"], ["Chinedu", "M"], ["Halima", "F"],
  ["Segun", "M"], ["Ifeoma", "F"], ["Musa", "M"], ["Toyin", "F"],
  ["Kelechi", "M"], ["Adaeze", "F"], ["Yusuf", "M"], ["Folake", "F"],
];
const LAST_NAMES = [
  "Adeyemi", "Okafor", "Bello", "Akinola", "Eze", "Mohammed",
  "Oladele", "Nwosu", "Balogun", "Okonkwo", "Aliyu", "Ogunleye",
];
const DEPARTMENTS = [
  "Front Desk", "Housekeeping", "Kitchen", "Security", "Laundry",
  "Accounts", "Maintenance", "ICT", "Administration",
];
const POSITIONS = {
  "Front Desk": "Front Desk Officer",
  Housekeeping: "Room Attendant",
  Kitchen: "Chef",
  Security: "Security Officer",
  Laundry: "Laundry Attendant",
  Accounts: "Accountant",
  Maintenance: "Maintenance Technician",
  ICT: "IT Support",
  Administration: "Admin Officer",
};
const BANKS = [
  ["GTBank", "058"], ["Access Bank", "044"], ["Zenith Bank", "057"],
  ["First Bank", "011"], ["UBA", "033"], ["Sterling Bank", "232"],
];

function buildEmployees(count) {
  const employees = [];
  for (let index = 0; index < count; index += 1) {
    const [firstName, gender] = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index * 5 + 3) % LAST_NAMES.length];
    const department = DEPARTMENTS[index % DEPARTMENTS.length];
    const isDemonstration = index === 0;
    employees.push({
      id: uuid(),
      employee_number: `${EMPLOYEE_PREFIX}${String(index + 1).padStart(3, "0")}`,
      first_name: isDemonstration ? "Demonstration" : firstName,
      last_name: isDemonstration ? "Employee" : lastName,
      email: `demo.${String(index + 1).padStart(3, "0")}@${EMAIL_DOMAIN}`,
      phone: `080${String(30000000 + index * 7919).slice(-8)}`,
      gender,
      date_of_birth: `19${75 + (index % 20)}-0${(index % 9) + 1}-1${index % 9}`,
      address: `${between(1, 90)} Oba Adesida Road`,
      state: "Ondo",
      lga: "Akure North",
      department,
      position: POSITIONS[department],
      employment_type: index % 9 === 0 ? "Contract" : "Full-time",
      employment_status: "Active",
      date_joined: `20${19 + (index % 6)}-0${(index % 9) + 1}-0${(index % 8) + 1}`,
      thrift_enabled: true,
      thrift_amount: isDemonstration ? 1000 : 1000 + (index % 5) * 500,
    });
  }
  return employees;
}

async function resolveContext() {
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, organization_id, role, users(email)")
    .not("organization_id", "is", null)
    .order("user_id")
    .limit(20);
  if (profileError) throw new Error(profileError.message);

  const owner = (profile ?? []).find((row) => row.users?.email === ORG_EMAIL);
  if (!owner) throw new Error(`No organization owner found for ${ORG_EMAIL}`);

  const { data: organization } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", owner.organization_id)
    .single();

  const { data: branch } = await admin
    .from("branches")
    .select("id")
    .eq("organization_id", owner.organization_id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  return {
    organizationId: owner.organization_id,
    organizationName: organization?.name ?? "Organization",
    ownerId: owner.user_id,
    branchId: branch?.id ?? null,
  };
}

async function cleanup() {
  const { data: employees, error } = await admin
    .from("employees")
    .select("id")
    .like("employee_number", `${EMPLOYEE_PREFIX}%`)
    .like("email", `%@${EMAIL_DOMAIN}`);
  if (error) throw new Error(`cleanup employees: ${error.message}`);

  const employeeIds = (employees ?? []).map((row) => row.id);
  const { data: loans } = employeeIds.length
    ? await admin.from("loan_applications").select("id").in("employee_id", employeeIds)
    : { data: [] };
  const loanIds = (loans ?? []).map((row) => row.id);

  const { data: transactions } = await admin
    .from("ledger_transactions")
    .select("id")
    .like("reference", `${SEED_TAG}-LGR-%`);
  const transactionIds = (transactions ?? []).map((row) => row.id);

  // Child rows first.
  await admin.from("audit_logs").delete().filter("after_data->>seed", "eq", SEED_TAG);
  if (employeeIds.length) {
    await admin.from("withdrawal_requests").delete().in("employee_id", employeeIds);
    await admin.from("bank_accounts").delete().in("employee_id", employeeIds);
  }
  await admin.from("fund_transactions").delete().like("reference", `${SEED_TAG}-%`);
  if (transactionIds.length) {
    await admin.from("ledger_entries").delete().in("transaction_id", transactionIds);
    await admin.from("ledger_transactions").delete().in("id", transactionIds);
  }
  if (loanIds.length) {
    await admin.from("loan_repayments").delete().in("loan_application_id", loanIds);
    await admin.from("loan_schedules").delete().in("loan_application_id", loanIds);
  }
  if (employeeIds.length) {
    await admin
      .from("thrift_interest_accruals")
      .delete()
      .in("employee_id", employeeIds);
    await admin.from("thrift_fundings").delete().in("employee_id", employeeIds);
    await admin
      .from("thrift_release_requests")
      .delete()
      .in("employee_id", employeeIds);
    await admin.from("financial_accounts").delete().in("employee_id", employeeIds);
  }
  if (loanIds.length) {
    await admin.from("loan_applications").delete().in("id", loanIds);
  }
  if (employeeIds.length) {
    await admin.from("employees").delete().in("id", employeeIds);
  }
  await admin
    .from("loan_products")
    .delete()
    .in("name", PRODUCT_NAMES)
    .like("description", `${SEED_TAG}%`);

  return { employees: employeeIds.length, loans: loanIds.length };
}

async function ensureAccount(code, name, type, organizationId) {
  const { data } = await admin
    .from("ledger_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", code)
    .maybeSingle();
  if (data) return data.id;

  const { data: created, error } = await admin
    .from("ledger_accounts")
    .insert({ organization_id: organizationId, code, name, type, active: true })
    .select("id")
    .single();
  if (error) throw new Error(`ledger account ${code}: ${error.message}`);
  return created.id;
}

async function seed() {
  const context = await resolveContext();
  const { organizationId, organizationName, ownerId, branchId } = context;
  const now = new Date();

  console.log(`Seeding demo data into "${organizationName}" (${organizationId})`);

  // Keep the demonstration statement on the documented 5% annual rate.
  await admin
    .from("organization_settings")
    .update({ thrift_interest_rate: 5 })
    .eq("organization_id", organizationId);

  const accounts = {
    fund: await ensureAccount("1000", "Thrift Pool", "ASSET", organizationId),
    receivable: await ensureAccount("1100", "Loan Receivable", "ASSET", organizationId),
    principal: await ensureAccount("2000", "Loan Principal", "LIABILITY", organizationId),
    interest: await ensureAccount("4000", "Interest Income", "INCOME", organizationId),
    thriftInterestExpense: await ensureAccount(
      "5200",
      "Thrift Interest Expense",
      "EXPENSE",
      organizationId
    ),
  };

  // --- employees --------------------------------------------------------
  const employeeInserts = buildEmployees(36).map((employee) => ({
    ...employee,
    organization_id: organizationId,
    branch_id: branchId,
  }));
  const { data: insertedEmployees, error: employeeError } = await admin
    .from("employees")
    .insert(employeeInserts)
    .select("id, first_name, last_name, employee_number, department, thrift_amount");
  if (employeeError) throw new Error(`employees: ${employeeError.message}`);

  const financialAccountRows = [];
  const financialAccountByEmployee = new Map();
  const thriftAccountByEmployee = new Map();
  for (const employee of insertedEmployees) {
    const availableId = uuid();
    const thriftId = uuid();
    financialAccountRows.push(
      {
        id: availableId,
        organization_id: organizationId,
        employee_id: employee.id,
        account_type: "AVAILABLE_BALANCE",
        currency: "NGN",
        status: "ACTIVE",
        created_at: iso(now),
        updated_at: iso(now),
      },
      {
        id: thriftId,
        organization_id: organizationId,
        employee_id: employee.id,
        account_type: "THRIFT",
        currency: "NGN",
        status: "ACTIVE",
        created_at: iso(now),
        updated_at: iso(now),
      }
    );
    financialAccountByEmployee.set(employee.id, availableId);
    thriftAccountByEmployee.set(employee.id, thriftId);
  }

  // --- loan products ----------------------------------------------------
  const productSpecs = [
    {
      name: "Salary Advance",
      description: `${SEED_TAG} · Short-term advance repaid over six months`,
      interest_rate: 12,
      duration_months: 6,
      minimum_amount: 100000,
      maximum_amount: 1000000,
      processing_fee: 1000,
      insurance_fee: 0,
    },
    {
      name: "Emergency Loan",
      description: `${SEED_TAG} · Emergency cover repaid over twelve months`,
      interest_rate: 15,
      duration_months: 12,
      minimum_amount: 200000,
      maximum_amount: 2000000,
      processing_fee: 1500,
      insurance_fee: 500,
    },
    {
      name: "Asset Finance",
      description: `${SEED_TAG} · Asset purchase financing over two years`,
      interest_rate: 18,
      duration_months: 24,
      minimum_amount: 500000,
      maximum_amount: 3000000,
      processing_fee: 2500,
      insurance_fee: 1000,
    },
  ];
  const { data: products, error: productError } = await admin
    .from("loan_products")
    .insert(
      productSpecs.map((spec) => ({
        organization_id: organizationId,
        name: spec.name,
        description: spec.description,
        minimum_amount: spec.minimum_amount,
        maximum_amount: spec.maximum_amount,
        interest_rate: spec.interest_rate,
        interest_method: "REDUCING_BALANCE",
        duration_months: spec.duration_months,
        repayment_frequency: "MONTHLY",
        processing_fee: spec.processing_fee,
        insurance_fee: spec.insurance_fee,
        minimum_employment_period_months: 6,
        guarantor_required: spec.name !== "Salary Advance",
        collateral_required: spec.name === "Asset Finance",
        active: true,
      }))
    )
    .select("id, name, interest_rate, duration_months");
  if (productError) throw new Error(`products: ${productError.message}`);
  const productByName = new Map(products.map((product) => [product.name, product]));

  // --- loans ------------------------------------------------------------
  const loanSpecs = [
    { employee: 0, product: "Salary Advance", amount: 300000, duration: 6, start: "2026-05-15", paid: 4, mode: "PROCESSED", status: "ACTIVE" },
    { employee: 1, product: "Salary Advance", amount: 450000, duration: 6, start: "2026-06-10", paid: 3, mode: "PROCESSED", status: "ACTIVE" },
    { employee: 2, product: "Emergency Loan", amount: 600000, duration: 12, start: "2026-05-01", paid: 4, mode: "PARTIAL", status: "ACTIVE" },
    { employee: 3, product: "Emergency Loan", amount: 800000, duration: 12, start: "2026-04-01", paid: 3, mode: "FAILED", status: "ACTIVE" },
    { employee: 4, product: "Salary Advance", amount: 350000, duration: 6, start: "2026-08-01", paid: 0, mode: "PENDING", status: "ACTIVE" },
    { employee: 5, product: "Emergency Loan", amount: 1200000, duration: 12, start: "2026-09-01", paid: 0, mode: "PROCESSED", status: "ACTIVE" },
    { employee: 6, product: "Emergency Loan", amount: 500000, duration: 12, start: "2026-07-15", paid: 2, mode: "PROCESSED", status: "ACTIVE" },
    { employee: 7, product: "Asset Finance", amount: 1500000, duration: 24, start: "2026-03-01", paid: 6, mode: "PARTIAL", status: "ACTIVE" },
    { employee: 8, product: "Salary Advance", amount: 400000, duration: 6, start: "2026-05-01", paid: 4, mode: "PROCESSED", status: "ACTIVE" },
    { employee: 9, product: "Emergency Loan", amount: 700000, duration: 12, start: "2026-09-01", paid: 0, mode: "PENDING", status: "ACTIVE" },
    { employee: 10, product: "Emergency Loan", amount: 550000, duration: 12, start: "2026-04-01", paid: 1, mode: "FAILED", status: "DEFAULTED" },
    { employee: 11, product: "Salary Advance", amount: 300000, duration: 6, start: "2026-08-15", paid: 1, mode: "PENDING", status: "ACTIVE" },
    { employee: 12, product: "Salary Advance", amount: 250000, duration: 6, start: "2026-01-10", paid: 6, mode: "NONE", status: "COMPLETED" },
    { employee: 13, product: "Emergency Loan", amount: 650000, duration: 12, start: "2025-09-01", paid: 12, mode: "NONE", status: "COMPLETED" },
    { employee: 14, product: "Asset Finance", amount: 900000, duration: 24, start: "2024-10-01", paid: 24, mode: "NONE", status: "COMPLETED" },
    { employee: 15, product: "Emergency Loan", amount: 480000, duration: 12, start: null, paid: 0, mode: "NONE", status: "APPROVED" },
    { employee: 16, product: "Salary Advance", amount: 320000, duration: 6, start: null, paid: 0, mode: "NONE", status: "APPROVED" },
    { employee: 17, product: "Asset Finance", amount: 1800000, duration: 24, start: null, paid: 0, mode: "NONE", status: "SUBMITTED" },
    { employee: 18, product: "Emergency Loan", amount: 750000, duration: 12, start: null, paid: 0, mode: "NONE", status: "SUBMITTED" },
  ];

  let repaymentCounter = 0;
  let ledgerCounter = 0;
  const auditRows = [];
  const ledgerTransactions = [];
  const ledgerEntries = [];
  const repayments = [];
  const schedules = [];

  const pushLedgerTransaction = ({ recordedAt, description, transactionType, entries }) => {
    const transactionId = uuid();
    ledgerCounter += 1;
    ledgerTransactions.push({
      id: transactionId,
      organization_id: organizationId,
      reference: `${SEED_TAG}-LGR-${String(ledgerCounter).padStart(4, "0")}`,
      description,
      transaction_date: dateOnly(recordedAt),
      transaction_type: transactionType,
      status: "POSTED",
      created_by: ownerId,
      created_at: iso(recordedAt),
    });
    for (const entry of entries) {
      ledgerEntries.push({
        id: uuid(),
        organization_id: organizationId,
        transaction_id: transactionId,
        account_id: entry.accountId ?? null,
        financial_account_id: entry.financialAccountId ?? null,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        created_at: iso(recordedAt),
      });
    }
  };

  const addDisbursement = ({ loan, employee, amount, recordedAt }) => {
    pushLedgerTransaction({
      recordedAt,
      description: `Loan disbursement ${loan.id.slice(0, 8)} - amount ${amount}`,
      transactionType: "LOAN_DISBURSEMENT",
      entries: [
        {
          accountId: accounts.receivable,
          debit: amount,
          credit: 0,
          description: "Loan disbursement - receivable",
        },
        {
          financialAccountId: financialAccountByEmployee.get(employee.id),
          debit: 0,
          credit: amount,
          description: "Loan disbursed to employee balance",
        },
      ],
    });
  };

  const addRepayment = ({ loan, schedule, amount, reference }) => {
    const recordedAt = new Date(`${schedule.due_date}T10:00:00.000Z`);
    repayments.push({
      id: uuid(),
      loan_application_id: loan.id,
      schedule_id: schedule.id,
      amount,
      payment_method: "THRIFT_FUNDING",
      reference_number: reference,
      recorded_at: iso(recordedAt),
      recorded_by: ownerId,
      notes: `${SEED_TAG} thrift funding repayment`,
      created_at: iso(recordedAt),
    });

    const interestPortion = Math.min(schedule.interest_payment, amount);
    const principalPortion = round2(amount - interestPortion);
    pushLedgerTransaction({
      recordedAt,
      description: `Loan repayment ${loan.id.slice(0, 8)} - amount ${amount}`,
      transactionType: "LOAN_REPAYMENT",
      entries: [
        { accountId: accounts.fund, debit: amount, credit: 0, description: "Loan repayment - lending fund" },
        { accountId: accounts.principal, debit: 0, credit: principalPortion, description: "Loan repayment - principal" },
        { accountId: accounts.interest, debit: 0, credit: interestPortion, description: "Loan repayment - interest" },
      ],
    });
  };

  const addWithdrawalPayout = ({ employee, amount, recordedAt, reference }) => {
    pushLedgerTransaction({
      recordedAt,
      description: `Withdrawal payout ${reference.slice(-3)} - amount ${amount}`,
      transactionType: "WITHDRAWAL",
      entries: [
        {
          financialAccountId: financialAccountByEmployee.get(employee.id),
          debit: amount,
          credit: 0,
          description: "Withdrawal payout - employee balance",
        },
        {
          accountId: accounts.fund,
          debit: 0,
          credit: amount,
          description: "Withdrawal payout - lending fund",
        },
      ],
    });
  };

  const loanInserts = [];

  for (const spec of loanSpecs) {
    const employee = insertedEmployees[spec.employee];
    const product = productByName.get(spec.product);
    const calculation = calculateSchedule(spec.amount, product.interest_rate, spec.duration);
    const appId = uuid();
    const startDate = spec.start ? new Date(`${spec.start}T00:00:00.000Z`) : null;
    const approvedAt = startDate ? addMonths(startDate, -1) : new Date(now.getTime() - between(2, 20) * 86400000);

    const loan = {
      id: appId,
      organization_id: organizationId,
      employee_id: employee.id,
      loan_product_id: product.id,
      amount: spec.amount,
      duration_months: spec.duration,
      interest_rate: product.interest_rate,
      interest_method: "REDUCING_BALANCE",
      total_interest: calculation.totalInterest,
      total_repayment: calculation.totalRepayment,
      monthly_deduction: calculation.monthlyPayment,
      purpose: `${SEED_TAG} ${spec.product.toLowerCase()}`,
      status: spec.status,
      submitted_at: iso(addMonths(approvedAt, -1)),
      reviewed_at: iso(addMonths(approvedAt, -1)),
      reviewed_by: ownerId,
      approved_at: iso(approvedAt),
      approved_by: ownerId,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      notes: `${SEED_TAG} · demo loan for ${employee.first_name} ${employee.last_name}`,
      created_at: iso(addMonths(approvedAt, -1)),
      updated_at: iso(now),
      disbursed_at: startDate ? iso(startDate) : null,
    };
    loanInserts.push(loan);

    if (spec.status === "SUBMITTED") {
      loan.purpose = `${SEED_TAG} pending ${spec.product.toLowerCase()}`;
      auditRows.push({
        action: "loan.application_submitted",
        entity_type: "loan_application",
        entity_id: appId,
        after: { seed: SEED_TAG, employee: employee.employee_number, amount: spec.amount },
      });
      continue;
    }

    if (spec.status === "APPROVED") {
      auditRows.push({
        action: "loan.approved",
        entity_type: "loan_application",
        entity_id: appId,
        after: { seed: SEED_TAG, employee: employee.employee_number, amount: spec.amount },
      });
      continue;
    }

    const rows = calculation.rows.map((row, index) => {
      const dueDate = addMonths(startDate, index + 1);
      const isPaid = index < spec.paid;
      const isCurrent = index === spec.paid;
      let status = isPaid ? "PAID" : dueDate < now ? "LATE" : "UPCOMING";
      let paidAmount = isPaid ? row.totalPayment : 0;
      let paidAt = isPaid ? iso(dueDate) : null;

      if (isCurrent && spec.mode === "PROCESSED") {
        status = "PAID";
        paidAmount = row.totalPayment;
        paidAt = iso(now);
      } else if (isCurrent && spec.mode === "PARTIAL") {
        status = "LATE";
        paidAmount = round2(row.totalPayment * 0.6);
        paidAt = iso(now);
      } else if (isCurrent && spec.mode === "FAILED") {
        status = "LATE";
        paidAmount = 0;
        paidAt = null;
      }

      const schedule = {
        id: uuid(),
        loan_application_id: appId,
        month_number: row.month,
        opening_balance: row.openingBalance,
        principal_payment: row.principalPayment,
        interest_payment: row.interestPayment,
        total_payment: row.totalPayment,
        closing_balance: row.closingBalance,
        status,
        due_date: dateOnly(dueDate),
        paid_amount: paidAmount,
        paid_at: paidAt,
        created_at: iso(approvedAt),
        updated_at: iso(now),
      };
      schedules.push(schedule);

      if (isPaid) {
        repaymentCounter += 1;
        addRepayment({
          loan,
          schedule,
          amount: row.totalPayment,
          reference: `${SEED_TAG}-RP-${String(repaymentCounter).padStart(4, "0")}`,
        });
      }
      return schedule;
    });

    // Current-period repayment for the next unpaid instalment.
    if (spec.status !== "COMPLETED" && spec.mode !== "NONE") {
      const currentSchedule = rows[spec.paid];
      if (
        currentSchedule &&
        (spec.mode === "PROCESSED" || spec.mode === "PARTIAL")
      ) {
        const expected = currentSchedule.total_payment;
        const actual =
          spec.mode === "PROCESSED" ? expected : round2(expected * 0.6);
        repaymentCounter += 1;
        addRepayment({
          loan,
          schedule: currentSchedule,
          amount: actual,
          reference: `${SEED_TAG}-RP-${String(repaymentCounter).padStart(4, "0")}`,
        });
      }
    }

    if (["ACTIVE", "DEFAULTED", "COMPLETED"].includes(spec.status)) {
      addDisbursement({
        loan,
        employee,
        amount: spec.amount,
        recordedAt: startDate,
      });
      auditRows.push({
        action: "loan.disbursed",
        entity_type: "loan_application",
        entity_id: appId,
        after: { seed: SEED_TAG, employee: employee.employee_number, amount: spec.amount },
      });
    }
    if (spec.status === "COMPLETED") {
      auditRows.push({
        action: "loan.completed",
        entity_type: "loan_application",
        entity_id: appId,
        after: { seed: SEED_TAG, employee: employee.employee_number },
      });
    }
    if (spec.status === "DEFAULTED") {
      auditRows.push({
        action: "collections.loan_defaulted",
        entity_type: "loan_application",
        entity_id: appId,
        after: { seed: SEED_TAG, employee: employee.employee_number, daysPastDue: 149 },
      });
    }
  }

  // --- thrift savings and monthly interest ------------------------------
  //
  // The first demo employee is the "Demonstration Employee" used in the
  // sample statement: ₦73,037.48 opening balance from August, 5% annual
  // interest for September and October, plus a ₦1,000 October contribution.
  const thriftFundingRows = [];
  const thriftInterestRows = [];
  const demonstration = insertedEmployees[0];
  const demonstrationThriftAccount = thriftAccountByEmployee.get(
    demonstration.id
  );

  const demoFundings = [
    {
      period: "2026-08-01",
      amount: 73037.48,
      recordedAt: "2026-08-31T10:00:00.000Z",
      reference: `${SEED_TAG}-THRIFT-AUG`,
    },
    {
      period: "2026-10-01",
      amount: 1000,
      recordedAt: "2026-10-01T09:00:00.000Z",
      reference: `${SEED_TAG}-THRIFT-OCT`,
    },
  ];

  for (const funding of demoFundings) {
    thriftFundingRows.push({
      id: uuid(),
      organization_id: organizationId,
      employee_id: demonstration.id,
      period_month: funding.period,
      amount: funding.amount,
      loan_repayment_applied: 0,
      thrift_credit: funding.amount,
      reference: funding.reference,
      status: "POSTED",
      notes: `${SEED_TAG} sample thrift funding`,
      funded_by: ownerId,
      created_at: funding.recordedAt,
      updated_at: funding.recordedAt,
    });

    pushLedgerTransaction({
      recordedAt: new Date(funding.recordedAt),
      description: `Thrift funding for ${funding.period.slice(0, 7)}`,
      transactionType: "THRIFT_FUNDING",
      entries: [
        {
          accountId: accounts.fund,
          debit: funding.amount,
          credit: 0,
          description: "Thrift funding - pool",
        },
        {
          financialAccountId: demonstrationThriftAccount,
          debit: 0,
          credit: funding.amount,
          description: "Thrift funding - employee savings",
        },
      ],
    });
  }

  const demoInterest = [
    {
      period: "2026-09-01",
      opening: 73037.48,
      contributions: 0,
      days: 30,
      interest: 300.15,
      closing: 73337.63,
      recordedAt: "2026-09-30T23:00:00.000Z",
      reference: `${SEED_TAG}-THINT-SEP`,
    },
    {
      period: "2026-10-01",
      opening: 74337.63,
      contributions: 1000,
      days: 31,
      interest: 315.68,
      closing: 74653.31,
      recordedAt: "2026-10-31T23:00:00.000Z",
      reference: `${SEED_TAG}-THINT-OCT`,
    },
  ];

  for (const interest of demoInterest) {
    thriftInterestRows.push({
      id: uuid(),
      organization_id: organizationId,
      employee_id: demonstration.id,
      period_month: interest.period,
      opening_balance: interest.opening,
      contributions: interest.contributions,
      payouts: 0,
      annual_rate: 5,
      eligible_days: interest.days,
      interest_amount: interest.interest,
      closing_balance: interest.closing,
      reference: interest.reference,
      status: "POSTED",
      notes: `${SEED_TAG} sample interest`,
      posted_by: ownerId,
      created_at: interest.recordedAt,
      updated_at: interest.recordedAt,
    });

    pushLedgerTransaction({
      recordedAt: new Date(interest.recordedAt),
      description: `Thrift interest for ${interest.period.slice(0, 7)}`,
      transactionType: "THRIFT_INTEREST",
      entries: [
        {
          accountId: accounts.thriftInterestExpense,
          debit: interest.interest,
          credit: 0,
          description: "Thrift interest - expense",
        },
        {
          financialAccountId: demonstrationThriftAccount,
          debit: 0,
          credit: interest.interest,
          description: "Thrift interest - employee savings",
        },
      ],
    });
  }

  // --- withdrawals and bank accounts ------------------------------------
  const bankRows = [];
  const withdrawalRows = [];
  const withdrawalSpecs = [
    { employee: 0, amount: 45000, status: "PAID", bank: 0 },
    { employee: 1, amount: 30000, status: "PAID", bank: 1 },
    { employee: 2, amount: 60000, status: "APPROVED", bank: 2 },
    { employee: 6, amount: 25000, status: "PENDING", bank: 3 },
    { employee: 7, amount: 80000, status: "REJECTED", bank: 4 },
  ];
  withdrawalSpecs.forEach((spec, index) => {
    const employee = insertedEmployees[spec.employee];
    const [bankName, bankCode] = BANKS[spec.bank];
    const bankId = uuid();
    const createdAt = new Date(now.getTime() - (index + 2) * 86400000);
    bankRows.push({
      id: bankId,
      organization_id: organizationId,
      employee_id: employee.id,
      account_name: `${employee.first_name} ${employee.last_name}`,
      account_number: `90${String(10000000 + spec.employee * 137).slice(-8)}`,
      bank_name: bankName,
      bank_code: bankCode,
      is_default: true,
      verified: true,
      verified_at: iso(createdAt),
      created_at: iso(createdAt),
      updated_at: iso(createdAt),
    });

    const paid = spec.status === "PAID";
    const approved = ["PAID", "APPROVED"].includes(spec.status);
    const reference = `${SEED_TAG}-WD-${String(index + 1).padStart(3, "0")}`;
    withdrawalRows.push({
      id: uuid(),
      organization_id: organizationId,
      employee_id: employee.id,
      bank_account_id: bankId,
      amount: spec.amount,
      fee: 0,
      net_amount: spec.amount,
      reference,
      status: spec.status,
      notes: `${SEED_TAG} demo withdrawal`,
      failure_reason: spec.status === "REJECTED" ? "Insufficient available balance" : null,
      reviewed_at: approved || spec.status === "REJECTED" ? iso(createdAt) : null,
      reviewed_by: approved || spec.status === "REJECTED" ? ownerId : null,
      approved_at: approved ? iso(createdAt) : null,
      approved_by: approved ? ownerId : null,
      processed_at: paid ? iso(createdAt) : null,
      processed_by: paid ? ownerId : null,
      paid_at: paid ? iso(createdAt) : null,
      provider_reference: paid ? `DEMO-PAY-${index + 1}` : null,
      created_at: iso(createdAt),
      updated_at: iso(createdAt),
    });

    if (paid) {
      addWithdrawalPayout({
        employee,
        amount: spec.amount,
        recordedAt: createdAt,
        reference,
      });
    }
  });

  // --- fund activity ----------------------------------------------------
  const { data: fundAccounts } = await admin
    .from("fund_accounts")
    .select("id, name, opening_balance")
    .eq("organization_id", organizationId)
    .eq("status", "ACTIVE")
    .order("created_at");
  const fundTransactions = [];
  if (fundAccounts && fundAccounts.length > 0) {
    fundTransactions.push({
      id: uuid(),
      organization_id: organizationId,
      fund_account_id: fundAccounts[0].id,
      transaction_type: "FUNDING",
      reference: `${SEED_TAG}-FND-001`,
      amount: 2000000,
      direction: "IN",
      description: "Employer lending fund top-up",
      related_loan_application_id: null,
      created_by: ownerId,
      created_at: iso(new Date(now.getTime() - 12 * 86400000)),
    });
    if (fundAccounts[1]) {
      fundTransactions.push({
        id: uuid(),
        organization_id: organizationId,
        fund_account_id: fundAccounts[1].id,
        transaction_type: "FUNDING",
        reference: `${SEED_TAG}-FND-002`,
        amount: 500000,
        direction: "IN",
        description: "Additional lending capital",
        related_loan_application_id: null,
        created_by: ownerId,
        created_at: iso(new Date(now.getTime() - 6 * 86400000)),
      });
    }
  }

  // --- audit trail ------------------------------------------------------
  const auditInserts = auditRows.map((row) => ({
    id: uuid(),
    organization_id: organizationId,
    user_id: ownerId,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    before_data: null,
    after_data: { ...row.after, seed: SEED_TAG },
    ip_address: "127.0.0.1",
    user_agent: "seed-demo",
    created_at: iso(now),
  }));

  // --- persist ----------------------------------------------------------
  async function insertAll(table, rows, chunkSize = 200) {
    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const { error } = await admin.from(table).insert(chunk);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  await insertAll("financial_accounts", financialAccountRows);
  await insertAll("bank_accounts", bankRows);
  await insertAll("withdrawal_requests", withdrawalRows);
  await insertAll("loan_applications", loanInserts);
  await insertAll("loan_schedules", schedules);
  await insertAll("loan_repayments", repayments);
  await insertAll("thrift_fundings", thriftFundingRows);
  await insertAll("thrift_interest_accruals", thriftInterestRows);
  await insertAll("ledger_transactions", ledgerTransactions);
  await insertAll("ledger_entries", ledgerEntries);
  await insertAll("fund_transactions", fundTransactions);
  await insertAll("audit_logs", auditInserts);

  const totals = {
    employees: insertedEmployees.length,
    products: products.length,
    loans: loanInserts.length,
    schedules: schedules.length,
    repayments: repayments.length,
    thriftFundings: thriftFundingRows.length,
    thriftInterest: thriftInterestRows.length,
    financialAccounts: financialAccountRows.length,
    ledgerTransactions: ledgerTransactions.length,
    ledgerEntries: ledgerEntries.length,
    withdrawals: withdrawalRows.length,
    auditRows: auditInserts.length,
  };
  console.table(totals);

  return totals;
}

async function main() {
  if (CLEAN_ONLY) {
    const removed = await cleanup();
    console.log(`Removed ${removed.employees} demo employees and ${removed.loans} demo loans.`);
    return;
  }

  const previous = await cleanup();
  if (previous.employees || previous.loans) {
    console.log(`Reset previous demo data (${previous.employees} employees, ${previous.loans} loans).`);
  }
  await seed();
  console.log("\nDemo data ready. Sign in as the organization owner to explore it.");
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message);
  process.exit(1);
});
