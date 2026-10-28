import type { Metadata } from "next";
import { WithdrawalService } from "@/services/withdrawal-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { RequestWithdrawalForm } from "@/components/employee/withdrawals/request-withdrawal-form";
import { BankAccountCard } from "@/components/employee/withdrawals/bank-account-card";
import { WithdrawalsHistory } from "@/components/employee/withdrawals/withdrawals-history";

export const metadata: Metadata = {
  title: "Withdrawals",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function EmployeeWithdrawalsPage() {
  const service = await WithdrawalService.create();
  const [accounts, withdrawals, balance] = await Promise.all([
    service.listBankAccounts(),
    service.listMyWithdrawals(),
    service.getAvailableBalance(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Move money from your available balance to your bank account
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-primary">{naira(balance)}</p>
            </div>
            <Wallet className="size-8 text-primary/40" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Request Withdrawal</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RequestWithdrawalForm
                accounts={accounts.map((a) => ({
                  id: a.id,
                  bankName: a.bank_name,
                  masked: a.masked,
                  accountName: a.account_name,
                }))}
                balance={balance}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Bank Accounts</span>
                <BankAccountCard />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No bank accounts yet. Add one to request a withdrawal.
                </p>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{account.bank_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.account_name} · {account.masked}
                        {account.verified ? " · verified" : " · unverified"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {account.verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No withdrawal requests yet.
              </p>
            ) : (
              <WithdrawalsHistory
                withdrawals={withdrawals.map((w) => ({
                  id: w.id,
                  amount: Number(w.amount),
                  status: w.status,
                  reference: w.reference,
                  createdAt: w.created_at,
                  bankName: w.bankName ?? "",
                  masked: w.masked ?? "",
                  failureReason: w.failure_reason ?? null,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}