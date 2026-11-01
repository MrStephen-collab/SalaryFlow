import type { Metadata } from "next";
import { EmployeePortalService } from "@/services/employee-portal-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpRight, ArrowDownLeft, PiggyBank } from "lucide-react";

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
  const [balance, transactions, thriftBalance] = await Promise.all([
    service.getAvailableBalance(),
    service.getTransactions(),
    service.getThriftBalance(),
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

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Available Balance
              </p>
              <Wallet className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-primary sm:mt-2 sm:text-2xl">
              {naira(balance)}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Total Credits In
              </p>
              <ArrowDownLeft className="size-3.5 shrink-0 text-green-600 sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-green-600 sm:mt-2 sm:text-2xl">
              {naira(credits)}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Total Deductions
              </p>
              <ArrowUpRight className="size-3.5 shrink-0 text-red-600 sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-red-600 sm:mt-2 sm:text-2xl">
              {naira(debits)}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-4 sm:py-6">
          <CardContent className="px-3 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Thrift Savings
              </p>
              <PiggyBank className="size-3.5 shrink-0 text-amber-600 sm:size-4" />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-amber-600 sm:mt-2 sm:text-2xl">
              {naira(thriftBalance)}
            </p>
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