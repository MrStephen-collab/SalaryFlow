import { NextRequest, NextResponse } from "next/server";
import { DisbursementService } from "@/services/disbursement-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily payroll sweep (Vercel Cron). Pays every salary period whose payment
 * date has arrived, for organizations that enabled automatic disbursement.
 *
 * Protected with CRON_SECRET; Vercel sends it as "Authorization: Bearer ...".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";

  if (secret) {
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on this deployment" },
      { status: 503 }
    );
  }

  try {
    const result = await DisbursementService.runDue();

    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    const failed = result.results.filter((entry) => !entry.ok);

    return NextResponse.json({
      ok: failed.length === 0,
      paid: result.results.length - failed.length,
      attempted: result.results.length,
      results: result.results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payroll sweep failed";
    console.error("[cron/payroll]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
