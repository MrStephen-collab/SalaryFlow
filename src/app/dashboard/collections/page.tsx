import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CollectionsService, type RiskBucket } from "@/services/collections-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { RefreshOverdueButton } from "@/components/dashboard/collections/refresh-overdue-button";
import { NameSearch } from "@/components/dashboard/name-search";

export const metadata: Metadata = {
  title: "Collections",
};

const BUCKET_ORDER: RiskBucket[] = ["1-30", "31-60", "61-90", "90+"];

const BUCKET_LABELS: Record<RiskBucket, string> = {
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

function riskVariant(bucket: RiskBucket) {
  switch (bucket) {
    case "90+":
      return "destructive" as const;
    case "61-90":
      return "destructive" as const;
    case "31-60":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireUser();
  const service = await CollectionsService.create();

  if (!service.canViewCollections()) {
    redirect("/dashboard");
  }

  const [summary, loans] = await Promise.all([
    service.getSummary(),
    service.listDelinquentLoans(),
  ]);

  const term = (q ?? "").trim().toLowerCase();
  const filteredLoans = term
    ? loans.filter((loan) =>
        `${loan.employeeName ?? ""} ${loan.employeeNumber ?? ""}`
          .toLowerCase()
          .includes(term)
      )
    : loans;

  const canManage = service.canManageCollections();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Overdue loans, default risk and collection follow-up.
          </p>
        </div>
        {canManage ? <RefreshOverdueButton /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Delinquent loans</p>
            <p className="text-2xl font-bold">{summary.delinquentLoans}</p>
            <p className="text-xs text-muted-foreground">
              Avg. {summary.averageDaysPastDue} days past due
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Overdue amount</p>
            <p className="text-2xl font-bold text-red-600">
              {naira(summary.totalOverdue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {naira(summary.totalOutstanding)} total outstanding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Defaulted (90+ days)</p>
            <p className="text-2xl font-bold">{summary.defaultedLoans}</p>
            <p className="text-xs text-muted-foreground">
              Flagged automatically from overdue schedules
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Ageing buckets</CardTitle>
          <CardDescription>
            Overdue exposure grouped by how long repayment has been outstanding.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-4">
          {BUCKET_ORDER.map((bucket) => (
            <div key={bucket} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {BUCKET_LABELS[bucket]}
                </p>
                <Badge variant={riskVariant(bucket)}>
                  {summary.buckets[bucket].count}
                </Badge>
              </div>
              <p className="mt-2 text-lg font-semibold">
                {naira(summary.buckets[bucket].amount)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Overdue loans</CardTitle>
              <CardDescription>
                Employees with at least one unpaid installment past its due date.
              </CardDescription>
            </div>
            <NameSearch placeholder="Search employee name or number…" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Days past due</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Loan</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={7} itemLabel="overdue loans">
              {filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {term
                      ? "No employee matches that name or number."
                      : "No overdue loans. Every active installment is on schedule."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((loan) => (
                  <TableRow key={loan.loanApplicationId}>
                    <TableCell>
                      <div className="text-sm font-medium">{loan.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {loan.employeeNumber} · {loan.department}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {loan.email ? (
                        <div className="truncate">{loan.email}</div>
                      ) : null}
                      {loan.phone ? (
                        <div className="text-muted-foreground">{loan.phone}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {loan.daysPastDue}
                      <div className="text-xs text-muted-foreground">
                        {loan.overdueInstallments} installment
                        {loan.overdueInstallments === 1 ? "" : "s"} · since{" "}
                        {formatDate(loan.firstDueDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-red-600">
                      {naira(loan.overdueAmount)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {naira(loan.totalOutstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant(loan.riskBucket)}>
                        {BUCKET_LABELS[loan.riskBucket]}
                      </Badge>
                      {loan.isDefaulted ? (
                        <div className="mt-1">
                          <Badge variant="destructive">DEFAULTED</Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            href={`/dashboard/loans/applications/${loan.loanApplicationId}`}
                          />
                        }
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </CollapsibleTableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
