import type { Metadata } from "next";
import { headers } from "next/headers";
import { StatementService } from "@/services/statement-service";
import { StatementActions } from "@/components/employee/statement-actions";
import { StatementDocument } from "@/components/employee/statement-document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Statement",
};

export default async function EmployeeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const service = await StatementService.create();
  const statement = await service.getStatement(from, to);

  if (!statement) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statement</h1>
          <p className="text-sm text-muted-foreground">
            Your account activity, payroll and receipts
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No employee profile found</p>
            <p className="text-sm text-muted-foreground">
              Your account is not linked to an employee record yet. Contact
              your HR administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const forwardedProto = headerList.get("x-forwarded-proto");
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (host ? `${forwardedProto ?? "http"}://${host}` : "http://localhost:3000");

  const query = `from=${statement.from}&to=${statement.to}`;
  const downloadHref = `/employee/statement/export?${query}`;
  const printHref = `/employee/statement/print?${query}`;
  const shareUrl = `${origin}/employee/statement?${query}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statement</h1>
          <p className="text-sm text-muted-foreground">
            Your account activity, payroll and receipts for the selected period
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            method="GET"
            className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="from" className="text-xs">
                From
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={statement.from}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="to" className="text-xs">
                To
              </Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={statement.to}
                className="w-40"
              />
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>

          <StatementActions
            downloadHref={downloadHref}
            printHref={printHref}
            shareUrl={shareUrl}
          />
        </div>
      </div>

      <StatementDocument statement={statement} printHeaderOnly />
    </div>
  );
}
