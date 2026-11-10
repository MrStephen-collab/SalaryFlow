import { NextResponse, type NextRequest } from "next/server";
import { StatementService } from "@/services/statement-service";
import {
  buildStatementWorkbook,
  statementFileName,
} from "@/lib/statement-export";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const service = await StatementService.create();
  const statement = await service.getStatement(
    request.nextUrl.searchParams.get("from") ?? undefined,
    request.nextUrl.searchParams.get("to") ?? undefined
  );

  if (!statement) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workbook = buildStatementWorkbook(statement);

  return new NextResponse(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${statementFileName(
        statement
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}
