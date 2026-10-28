"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusVariant(status: string) {
  switch (status) {
    case "PAID":
      return "default" as const;
    case "FAILED":
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export function WithdrawalsHistory({
  withdrawals,
}: {
  withdrawals: {
    id: string;
    amount: number;
    status: string;
    reference: string;
    createdAt: string;
    bankName: string;
    masked: string;
    failureReason: string | null;
  }[];
}) {
  return (
    <div className="flex flex-col">
      {withdrawals.map((w, index) => (
        <div
          key={w.id}
          className={`flex items-center justify-between gap-3 py-3 ${
            index > 0 ? "border-t" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{naira(w.amount)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {w.bankName} {w.masked} ·{" "}
              {new Date(w.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            {w.failureReason && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="size-3" />
                {w.failureReason}
              </p>
            )}
          </div>
          <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
        </div>
      ))}
    </div>
  );
}