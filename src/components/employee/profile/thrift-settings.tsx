function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Read-only thrift summary for the employee portal.
 *
 * Employees can no longer set their own amount: the employer owns the
 * withholding, so changes are made from the employer dashboard.
 */
export function ThriftSettings({
  amount,
  balance,
  enabled,
}: {
  amount: number;
  balance: number;
  enabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Current thrift balance</p>
          <p className="mt-1 text-lg font-semibold text-amber-600">
            {naira(balance)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Monthly thrift amount</p>
          <p className="mt-1 text-lg font-semibold">{naira(amount)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        Your employer sets your monthly thrift amount. Contact your HR or
        organization admin if you need it changed.
        {enabled
          ? ""
          : " Thrift is currently switched off for future funding."}
      </div>
    </div>
  );
}
