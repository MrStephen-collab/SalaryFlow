import { NextResponse, type NextRequest } from "next/server";
import { ReportService } from "@/services/report-service";
import { buildExcelWorkbook, reportFileName } from "@/lib/report-export";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const key = String(form.get("report") ?? "");
  if (!key) {
    return NextResponse.json({ error: "Missing report" }, { status: 400 });
  }

  const options = {
    startDate: String(form.get("startDate") ?? "") || undefined,
    endDate: String(form.get("endDate") ?? "") || undefined,
    department: String(form.get("department") ?? "") || undefined,
    branch: String(form.get("branch") ?? "") || undefined,
    employee: String(form.get("employee") ?? "") || undefined,
    productId: String(form.get("product") ?? "") || undefined,
    status: String(form.get("status") ?? "") || undefined,
  };

  const service = await ReportService.create();
  if (!service.hasAccess()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await service.runReport(key, options);
  if (report.columns.length === 0) {
    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }

  const filters: Array<[string, string]> = [];
  if (options.startDate || options.endDate) {
    filters.push([
      "Period",
      `${options.startDate ?? "start"} to ${options.endDate ?? "today"}`,
    ]);
  }
  if (options.department) filters.push(["Department", options.department]);
  if (options.branch) filters.push(["Branch", options.branch]);
  if (options.employee) filters.push(["Employee", options.employee]);
  if (options.productId) filters.push(["Product", options.productId]);
  if (options.status) filters.push(["Status", options.status]);

  const workbook = buildExcelWorkbook(report, {
    generatedAt: new Date().toISOString(),
    filters,
  });

  return new NextResponse(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFileName(report)}"`,
      "Cache-Control": "no-store",
    },
  });
}