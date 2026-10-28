import type { ReceiptView } from "@/services/receipt-service";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/report-export";

export function receiptStatusClasses(status: string) {
  switch (status) {
    case "PAID":
    case "PROCESSED":
    case "RECORDED":
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "FAILED":
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-600";
  }
}

export function ReceiptSheet({
  receipt,
  verifyUrl,
}: {
  receipt: ReceiptView;
  verifyUrl: string;
}) {
  return (
    <article
      data-receipt-sheet
      className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border bg-white text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
    >
      <div
        className="h-1.5 w-full"
        style={{
          backgroundColor: receipt.organization.primaryColor ?? "#171717",
        }}
      />

      <div className="p-6 sm:p-10">
        <header className="flex flex-col gap-6 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {receipt.organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.organization.logoUrl}
                alt=""
                className="h-14 w-14 rounded-lg border border-neutral-200 object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-900 text-lg font-bold text-white">
                {receipt.organization.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {receipt.organization.name}
              </h1>
              <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
                {receipt.organization.address && (
                  <p>{receipt.organization.address}</p>
                )}
                {receipt.organization.email && (
                  <p>{receipt.organization.email}</p>
                )}
                {receipt.organization.phone && (
                  <p>{receipt.organization.phone}</p>
                )}
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold tracking-[0.18em] text-neutral-500 uppercase">
              {receipt.typeLabel}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {receipt.receiptNumber}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Issued {formatDate(receipt.issuedAt)}
            </p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-neutral-200 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Issued to
            </p>
            <p className="mt-2 text-sm font-semibold">{receipt.employee.name}</p>
            {receipt.employee.number && (
              <p className="text-xs text-neutral-500">
                Employee number: {receipt.employee.number}
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Status
            </p>
            <span
              className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${receiptStatusClasses(
                receipt.status
              )}`}
            >
              {receipt.status.replace(/_/g, " ")}
            </span>
            <p className="mt-2 text-xs text-neutral-500">
              Reference{" "}
              <span className="font-mono text-neutral-700">
                {receipt.reference}
              </span>
            </p>
          </div>
        </section>

        <section className="py-6">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Amount
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {formatCurrency(receipt.amount)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">{receipt.description}</p>
        </section>

        <section className="rounded-lg border border-neutral-200">
          <dl className="divide-y divide-neutral-100">
            <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm">
              <dt className="text-neutral-500">Transaction reference</dt>
              <dd className="font-mono text-xs font-medium">
                {receipt.reference}
              </dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm">
              <dt className="text-neutral-500">Date recorded</dt>
              <dd className="font-medium">{formatDateTime(receipt.issuedAt)}</dd>
            </div>
            {receipt.details.map((detail) => (
              <div
                key={detail.label}
                className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm"
              >
                <dt className="text-neutral-500">{detail.label}</dt>
                <dd className="text-right font-medium">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-8 flex flex-col gap-6 border-t border-dashed border-neutral-300 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-sm">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Verification
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Scan or visit the link below to confirm this receipt. Only
              non-sensitive details are shown publicly.
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-neutral-500">
              {verifyUrl}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-neutral-400">
              Code: {receipt.verificationCode}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="mb-2 h-10 w-40 border-b border-neutral-400 sm:ml-auto" />
            <p className="text-xs font-medium">Authorised signature</p>
            <p className="text-[11px] text-neutral-500">
              Generated by SalaryFlow on behalf of{" "}
              {receipt.organization.name}
            </p>
          </div>
        </footer>
      </div>
    </article>
  );
}
