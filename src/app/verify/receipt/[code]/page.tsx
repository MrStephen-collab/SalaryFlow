import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptService } from "@/services/receipt-service";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/report-export";
import { receiptStatusClasses } from "@/components/receipts/receipt-sheet";
import { APP_NAME } from "@/config/constants";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Verify receipt",
  robots: { index: false, follow: false },
};

export default async function VerifyReceiptPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const verification = await ReceiptService.verifyReceipt(
    decodeURIComponent(code)
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <Link href="/" className="text-lg font-bold tracking-tight">
            {APP_NAME}
          </Link>
          <p className="text-xs text-muted-foreground">Receipt verification</p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {verification ? (
            <>
              <div className="border-b bg-emerald-50 px-6 py-8 text-center">
                <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
                <h1 className="mt-3 text-xl font-bold text-emerald-900">
                  Receipt verified
                </h1>
                <p className="mt-1 text-sm text-emerald-800">
                  This receipt matches a record held by{" "}
                  {verification.organizationName}.
                </p>
              </div>

              <dl className="divide-y px-6">
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Receipt number</dt>
                  <dd className="text-right font-mono font-medium">
                    {verification.receiptNumber}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Document</dt>
                  <dd className="text-right font-medium">
                    {verification.typeLabel}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Organization</dt>
                  <dd className="text-right font-medium">
                    {verification.organizationName}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Employee</dt>
                  <dd className="text-right font-medium">
                    {verification.employeeMasked}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right text-base font-bold">
                    {formatCurrency(verification.amount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="text-right font-mono text-xs font-medium">
                    {verification.reference}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Date issued</dt>
                  <dd className="text-right font-medium">
                    {formatDate(verification.issuedAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${receiptStatusClasses(
                        verification.status
                      )}`}
                    >
                      {verification.status.replace(/_/g, " ")}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="border-t bg-muted/40 px-6 py-4">
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  Verified on {formatDateTime(new Date().toISOString())}. This
                  confirms a matching record exists; it does not replace the
                  original receipt or expose private employee information.
                </p>
              </div>
            </>
          ) : (
            <div className="px-6 py-12 text-center">
              <XCircle className="mx-auto size-12 text-red-500" />
              <h1 className="mt-3 text-xl font-bold">Receipt not found</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                This verification code is invalid, incomplete, or no longer
                matches a receipt. Check the link and try again.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {APP_NAME} · Salary-based employee finance
        </p>
      </div>
    </div>
  );
}
