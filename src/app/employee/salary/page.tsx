import type { Metadata } from "next";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleList } from "@/components/ui/collapsible-list";
import { Banknote, ArrowDownUp, CircleMinus, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Salary",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function EmployeeSalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const service = await EmployeePortalService.create();
  const history = await service.getSalaryHistory();
  const periods = await service.listPeriods();

  const record = period
    ? history.find((r) => r.periodName === period) ?? history[0]
    : history[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salary</h1>
        <p className="text-sm text-muted-foreground">
          Select a month to view your payslip
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {periods.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No salary periods imported yet.
          </p>
        )}
        {(periods ?? []).map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={record?.periodName === p.name ? "default" : "outline"}
            render={<a href={`/employee/salary?period=${encodeURIComponent(p.name)}`} />}
          >
            {p.name}
          </Button>
        ))}
      </div>

      {!record ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No payslips available</p>
            <p className="text-sm text-muted-foreground">
              Your salary has not been imported for any period yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{record.periodName}</span>
                <Badge variant={record.status === "APPROVED" ? "default" : "secondary"}>
                  {record.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Net Salary</p>
                    <p className="text-2xl font-bold text-primary">
                      {naira(record.netSalary)}
                    </p>
                  </div>
                  <Wallet className="size-8 text-primary/40" />
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Banknote className="size-4" /> Gross Salary
                  </span>
                  <span className="font-medium">{naira(record.grossSalary)}</span>
                </div>
                <div className="flex justify-between pl-6 text-xs">
                  <span className="text-muted-foreground">Basic Salary</span>
                  <span>{naira(record.basicSalary)}</span>
                </div>
                <div className="flex justify-between pl-6 text-xs">
                  <span className="text-muted-foreground">Allowances</span>
                  <span>{naira(record.allowances)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CircleMinus className="size-4" /> Other Deductions
                  </span>
                  <span className="text-red-600">
                    -{naira(record.otherDeductions)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <ArrowDownUp className="size-4" /> Loan Deduction
                  </span>
                  <span className="text-red-600">
                    -{naira(record.loanDeductions)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Net Pay</span>
                  <span>{naira(record.netSalary)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                <CollapsibleList
                  className="flex flex-col gap-2"
                  itemLabel="payslips"
                >
                  {history.map((r) => (
                  <a
                    key={r.id}
                    href={`/employee/salary?period=${encodeURIComponent(r.periodName)}`}
                    className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="font-medium">{r.periodName}</p>
                      <p className="text-xs text-muted-foreground">
                        Gross {naira(r.grossSalary)} · Net {naira(r.netSalary)}
                      </p>
                    </div>
                    <Badge variant="outline">{r.status}</Badge>
                  </a>
                  ))}
                </CollapsibleList>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}