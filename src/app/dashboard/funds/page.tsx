import type { Metadata } from "next";
import { FundService } from "@/services/fund-service";
import { PaymentService } from "@/services/payment-service";
import { gatewayStatus } from "@/services/payment-provider";
import { FundMovementDialog } from "@/components/dashboard/ledger/fund-movement-dialog";
import { FundWalletDialog } from "@/components/dashboard/funds/fund-wallet-dialog";
import { FundMemberLoanPoolDialog } from "@/components/dashboard/funds/fund-member-loan-pool-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";

export const metadata: Metadata = {
  title: "Fund Management",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function FundsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; reason?: string; amount?: string }>;
}) {
  const params = await searchParams;
  const service = await FundService.create();
  const accounts = await service.listFundAccounts();
  const transactions = await service.listFundTransactions();
  const gatewayPayments = await PaymentService.listOrganizationPayments(10);
  const gateway = gatewayStatus();

  const accountsWithBalance = await Promise.all(
    accounts.map(async (account) => ({
      ...account,
      balance: await service.fundAccountBalance(account.id),
    }))
  );

  const totalBalance = accountsWithBalance.reduce(
    (s, a) => s + a.balance,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fund Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fund your salary pool online and track every movement
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FundWalletDialog gatewayReady={gateway.collections} />
          <FundMemberLoanPoolDialog gatewayReady={gateway.collections} />
        </div>
      </div>

      {params.payment === "success" && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Payment confirmed. Your salary pool has been credited
          {params.amount ? ` with ${naira(Number(params.amount))}` : ""}.
        </div>
      )}

      {params.payment === "pending" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          We have not received confirmation from the payment provider yet. If you
          were debited, this page will update automatically - refresh in a moment.
          {params.reason ? ` (${params.reason})` : ""}
        </div>
      )}

      {params.payment === "failed" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {params.reason ?? "The payment did not go through."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Lending Funds</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {naira(totalBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Accounts</CardDescription>
            <CardTitle className="text-2xl">
              {accounts.filter((a) => a.status === "ACTIVE").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent Movements</CardDescription>
            <CardTitle className="text-2xl">{transactions.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No fund accounts</p>
            <p className="text-sm text-muted-foreground">
              Create a fund account to start tracking your lending pool.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {accountsWithBalance.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {account.name}
                    <Badge
                      variant={account.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {account.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Opening: {naira(account.opening_balance)} · {account.currency}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Available Balance</p>
                  <p className="text-lg font-bold text-primary">
                    {naira(account.balance)}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <FundMovementDialog
                  fundAccountId={account.id}
                  fundAccountName={account.name}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={6} itemLabel="transactions">
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs">
                    {tx.reference}
                  </TableCell>
                  <TableCell className="text-sm">{tx.transaction_type}</TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${
                      tx.direction === "IN" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.direction === "IN" ? "+" : "-"}
                    {naira(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tx.direction === "IN" ? "default" : "destructive"}
                    >
                      {tx.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{tx.description}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(tx.created_at).toLocaleDateString("en-NG")}
                  </TableCell>
                </TableRow>
              ))}
            </CollapsibleTableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Online funding history</CardTitle>
          <CardDescription>
            {gateway.collections
              ? `Payments collected securely through ${gateway.provider}.`
              : "Online funding is not configured on this deployment yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gatewayPayments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No online payments yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Initiated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gatewayPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">
                      {payment.internal_reference}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {naira(Number(payment.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "SUCCESS"
                            ? "default"
                            : payment.status === "PENDING"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {payment.channel ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(payment.created_at).toLocaleString("en-NG")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
