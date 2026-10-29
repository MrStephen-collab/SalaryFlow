import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ReceiptService } from "@/services/receipt-service";
import { ReceiptSheet } from "@/components/receipts/receipt-sheet";
import { ReceiptActions } from "@/components/receipts/receipt-actions";
import { APP_NAME } from "@/config/constants";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { ArrowLeft } from "lucide-react";

interface ReceiptPageProps {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({
  params,
}: ReceiptPageProps): Promise<Metadata> {
  const { type } = await params;
  return {
    title: `${type.charAt(0).toUpperCase()}${type.slice(1)} receipt`,
    robots: { index: false, follow: false },
  };
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { type, id } = await params;
  const result = await ReceiptService.getReceipt(type, id);

  if ("error" in result) {
    if (result.error === "UNAUTHORIZED") {
      redirect(
        `/auth/login?redirect=${encodeURIComponent(`/receipts/${type}/${id}`)}`
      );
    }
    notFound();
  }

  const receipt = result.receipt;
  const headerList = await headers();
  const host = headerList.get("host");
  const forwardedProto = headerList.get("x-forwarded-proto");
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin =
    configuredUrl ||
    (host ? `${forwardedProto ?? "http"}://${host}` : "http://localhost:3000");

  const verifyPath = `/verify/receipt/${receipt.verificationCode}`;
  const verifyUrl = `${origin}${verifyPath}`;
  const receiptUrl = `${origin}/receipts/${receipt.type}/${receipt.id}`;

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-8 sm:py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-3xl flex-col gap-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <SalaryFlowLogo layout="horizontal" size="sm" label={null} />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to {APP_NAME}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Receipt {receipt.receiptNumber}
          </p>
        </div>
        <ReceiptActions receiptUrl={receiptUrl} verifyUrl={verifyUrl} />
      </div>

      <ReceiptSheet receipt={receipt} verifyUrl={verifyUrl} />

      <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground print:hidden">
        Anyone with the verification link can confirm this receipt. Only
        non-sensitive details are shown.
      </p>
    </div>
  );
}
