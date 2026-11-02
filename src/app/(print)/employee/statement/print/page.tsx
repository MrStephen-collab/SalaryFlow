import type { Metadata } from "next";
import Link from "next/link";
import { StatementService } from "@/services/statement-service";
import { StatementDocument } from "@/components/employee/statement-document";
import { PrintNowButton } from "@/components/employee/print-now-button";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Statement Print Preview",
};

export default async function StatementPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const service = await StatementService.create();
  const statement = await service.getStatement(from, to);

  if (!statement) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center">
          <p className="text-sm font-medium">No employee profile found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account is not linked to an employee record yet.
          </p>
          <Button className="mt-4" render={<Link href="/employee/statement" />}>
            <ArrowLeft className="size-4" />
            Back to statement
          </Button>
        </div>
      </div>
    );
  }

  const query = `from=${statement.from}&to=${statement.to}`;
  const downloadHref = `/employee/statement/export?${query}`;
  const backHref = `/employee/statement?${query}`;

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button variant="outline" render={<Link href={backHref} />}>
            <ArrowLeft className="size-4" />
            Back to statement
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <PrintNowButton />
            <Button variant="outline" render={<a href={downloadHref} />}>
              <Download className="size-4" />
              Download CSV
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none print:[&_table]:text-[11px] print:[&_td]:whitespace-normal print:[&_th]:whitespace-normal print:[&_td]:px-1 print:[&_th]:px-1">
          <StatementDocument statement={statement} expandAll />
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
          This page is the print preview. Use Print / Save PDF to print or save
          it as a PDF file.
        </p>
      </div>
    </div>
  );
}
