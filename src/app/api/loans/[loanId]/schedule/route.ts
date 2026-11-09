import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildLoanScheduleHtml,
  buildLoanSchedulePdf,
  buildLoanScheduleWorkbook,
  loanScheduleFileName,
  type LoanScheduleExportData,
} from "@/lib/loan-schedule-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Format = "pdf" | "xls" | "doc";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  const { loanId } = await params;
  const format = (request.nextUrl.searchParams.get("format") ?? "pdf") as Format;
  if (!["pdf", "xls", "doc"].includes(format)) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: loan } = await admin
    .from("loan_applications")
    .select("*, loan_products:loan_product_id(name)")
    .eq("id", loanId)
    .maybeSingle();

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  let borrowerName = "Borrower";
  let borrowerNumber = "";
  let ownsLoan = false;

  if (loan.employee_id) {
    const { data: employee } = await admin
      .from("employees")
      .select("id, user_id, first_name, last_name, employee_number")
      .eq("id", loan.employee_id)
      .maybeSingle();

    if (employee) {
      borrowerName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
      borrowerNumber = employee.employee_number ?? "";
      ownsLoan = employee.user_id === user.id;
    }
  } else if (loan.member_id) {
    const { data: member } = await admin
      .from("members")
      .select("id, user_id, first_name, last_name, member_number")
      .eq("id", loan.member_id)
      .maybeSingle();

    if (member) {
      borrowerName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
      borrowerNumber = member.member_number ?? "";
      ownsLoan = member.user_id === user.id;
    }
  }

  if (!ownsLoan) {
    // Staff attached to the same organization may download any schedule.
    const { data: profile } = await admin
      .from("user_profiles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = profile?.role as string | null;
    const isStaff =
      role === "SUPER_ADMIN" ||
      (Boolean(profile?.organization_id) &&
        profile?.organization_id === loan.organization_id &&
        (role === "ORGANIZATION_OWNER" || role === "ORGANIZATION_ADMIN"));

    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: schedules } = await admin
    .from("loan_schedules")
    .select(
      "month_number, due_date, opening_balance, principal_payment, interest_payment, total_payment, paid_amount, status"
    )
    .eq("loan_application_id", loanId)
    .order("month_number", { ascending: true });

  const product = loan.loan_products as unknown as { name: string | null } | null;

  const data: LoanScheduleExportData = {
    borrowerName,
    borrowerNumber,
    productName: product?.name ?? "Loan",
    amount: Number(loan.amount) || 0,
    totalInterest: Number(loan.total_interest) || 0,
    totalRepayment: Number(loan.total_repayment) || 0,
    monthly: Number(loan.monthly_deduction) || 0,
    interestRate: Number(loan.interest_rate) || 0,
    interestMethod: String(loan.interest_method ?? "FLAT"),
    durationMonths: Number(loan.duration_months) || 0,
    status: String(loan.status ?? ""),
    disbursedAt: (loan.disbursed_at as string | null) ?? null,
    generatedAt: new Date().toISOString(),
    schedule: (schedules ?? []).map((row) => ({
      month: Number(row.month_number) || 0,
      dueDate: (row.due_date as string | null) ?? null,
      opening: Number(row.opening_balance) || 0,
      principal: Number(row.principal_payment) || 0,
      interest: Number(row.interest_payment) || 0,
      total: Number(row.total_payment) || 0,
      paid: Number(row.paid_amount) || 0,
      status: String(row.status ?? ""),
    })),
  };

  if (format === "pdf") {
    const pdf = buildLoanSchedulePdf(data);
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${loanScheduleFileName(
          data,
          "pdf"
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "xls") {
    const workbook = buildLoanScheduleWorkbook(data);
    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${loanScheduleFileName(
          data,
          "xlsx"
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const html = buildLoanScheduleHtml(data, "doc");
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${loanScheduleFileName(
        data,
        "doc"
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}
