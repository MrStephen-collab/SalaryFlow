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

  const html = buildExcelWorkbook(report, { generatedAt: new Date().toISOString() });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportFileName(report)}"`,
      "Cache-Control": "no-store",
    },
  });
}