import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type LoanAnalysisLoan = {
  amount: number;
  interestRate: number;
  interestMethod: string;
  durationMonths: number;
  processingFee?: number;
  insuranceFee?: number;
  totalInterest: number;
  totalRepayment: number;
  monthly: number;
  status: string;
  disbursedAt?: string | null;
  purpose?: string | null;
};

export type LoanAnalysisSchedule = {
  month: number;
  dueDate?: string | null;
  openingBalance: number;
  principal: number;
  interest: number;
  total: number;
  paid: number;
  status: string;
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function scheduleVariant(status: string) {
  switch (status) {
    case "PAID":
      return "default" as const;
    case "DUE":
    case "LATE":
      return "destructive" as const;
    case "WAIVED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

/**
 * Detailed, plain-language loan analysis shared by the member, employee and
 * employer views: where the repayment goes, how much interest is left and the
 * full instalment schedule.
 */
export function LoanAnalysis({
  loan,
  schedules,
}: {
  loan: LoanAnalysisLoan;
  schedules: LoanAnalysisSchedule[];
}) {
  const totalRepayment = Number(loan.totalRepayment) || 0;
  const totalInterest = Number(loan.totalInterest) || 0;
  const fees =
    (Number(loan.processingFee) || 0) + (Number(loan.insuranceFee) || 0);

  let paid = 0;
  let principalPaid = 0;
  let interestPaid = 0;

  for (const entry of schedules) {
    const applied = Math.min(Number(entry.paid) || 0, Number(entry.total) || 0);
    if (applied <= 0) continue;
    paid += applied;
    const share =
      Number(entry.total) > 0 ? Number(entry.principal) / Number(entry.total) : 0;
    principalPaid += applied * share;
    interestPaid += applied - applied * share;
  }

  paid = Math.round(paid * 100) / 100;
  principalPaid = Math.round(principalPaid * 100) / 100;
  interestPaid = Math.round(interestPaid * 100) / 100;

  const outstanding = Math.max(0, Math.round((totalRepayment - paid) * 100) / 100);
  const principalRemaining = Math.max(
    0,
    Math.round(((Number(loan.amount) || 0) - principalPaid) * 100) / 100
  );
  const interestRemaining = Math.max(
    0,
    Math.round((totalInterest - interestPaid) * 100) / 100
  );
  const progress =
    totalRepayment > 0 ? Math.min(100, Math.round((paid / totalRepayment) * 1000) / 10) : 0;

  const principalPercent =
    Number(loan.amount) > 0
      ? Math.round((principalPaid / Number(loan.amount)) * 1000) / 10
      : 0;
  const interestPercent =
    totalInterest > 0 ? Math.round((interestPaid / totalInterest) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Loan amount</p>
            <p className="text-lg font-bold">{naira(Number(loan.amount) || 0)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {loan.interestRate}% {loan.interestMethod.toLowerCase()} ·{" "}
              {loan.durationMonths} months
            </p>
            {fees > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Credited to wallet{" "}
                <span className="font-medium text-foreground">
                  {naira(Math.max(0, (Number(loan.amount) || 0) - fees))}
                </span>{" "}
                after {naira(fees)} fees
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Interest</p>
            <p className="text-lg font-bold">{naira(totalInterest)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fees > 0 ? `Fees: ${naira(fees)} · ` : ""}Total repayable{" "}
              {naira(totalRepayment)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Paid so far</p>
            <p className="text-lg font-bold text-emerald-600">{naira(paid)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {progress}% of total repayment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-primary">{naira(outstanding)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Monthly {naira(Number(loan.monthly) || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How your repayments are applied</CardTitle>
          <CardDescription>
            Every repayment first covers the interest due, then reduces the
            principal. Interest gets smaller as the balance reduces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span>Principal repaid</span>
              <span className="font-medium">
                {naira(principalPaid)} of {naira(Number(loan.amount) || 0)}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                style={{ width: `${principalPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {principalPercent}% repaid · {naira(principalRemaining)} left
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span>Interest paid</span>
              <span className="font-medium">
                {naira(interestPaid)} of {naira(totalInterest)}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600"
                style={{ width: `${interestPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {interestPercent}% paid · {naira(interestRemaining)} left
            </p>
          </div>

          <div className="rounded-lg border p-3 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">Total repayable</span>
              <span className="font-medium">{naira(totalRepayment)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-medium text-emerald-600">{naira(paid)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium">{naira(outstanding)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Repayment schedule</CardTitle>
          <CardDescription>
            Each instalment, the interest inside it and what has been paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((entry) => (
                <TableRow key={entry.month}>
                  <TableCell className="text-sm">{entry.month}</TableCell>
                  <TableCell className="text-sm">
                    {entry.dueDate
                      ? new Date(entry.dueDate).toLocaleDateString("en-GB")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {naira(entry.openingBalance)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {naira(entry.principal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-600">
                    {naira(entry.interest)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {naira(entry.total)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {naira(Math.min(entry.paid, entry.total))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={scheduleVariant(entry.status)}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
