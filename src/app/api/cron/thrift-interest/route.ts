import { NextResponse, type NextRequest } from "next/server";
import { ThriftInterestService } from "@/services/thrift-interest-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed in production; allow local/manual runs without a secret.
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month") ?? undefined;
  const result = await ThriftInterestService.runForAllOrganizations(month);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

/** Vercel Cron calls GET. The endpoint is idempotent. */
export async function GET(request: NextRequest) {
  return run(request);
}

/** Manual trigger, e.g. curl -X POST -H "Authorization: Bearer $CRON_SECRET". */
export async function POST(request: NextRequest) {
  return run(request);
}
