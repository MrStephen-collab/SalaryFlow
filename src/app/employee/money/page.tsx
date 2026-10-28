import type { Metadata } from "next";
import { EmployeePortalService } from "@/services/employee-portal-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Money",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function EmployeeMoneyPage() {
  const service = await EmployeePortalService.create();
  const [balance, transactions] = await Promise.all([
    service.getAvailableBalance(),
    service.getTransactions(),
  ]);

  const credits = transactions.reduce((s, t) => s + t.credit, 0);
  const debits = transactions.reduce((s, t) => s + t.debit, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Money</h1>
        <p className="text-sm text-muted-foreground">
          Your available balance and transaction history
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <Wallet className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold text-primary">{naira(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Credits In</p>
              <ArrowDownLeft className="size-4 text-green-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {naira(credits)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Deductions</p>
              <ArrowUpRight className="size-4 text-red-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-red-600">{naira(debits)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Movements on your balance will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between gap-4 py-3 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tx.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.transactionDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {tx.reference}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.status === "REVERSED" && (
                      <Badge variant="outline">REVERSED</Badge>
                    )}
                    <span
                      className={`text-sm font-semibold ${
                        tx.credit > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.credit > 0 ? "+" : "-"}
                      {naira(tx.credit > 0 ? tx.credit : tx.debit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}