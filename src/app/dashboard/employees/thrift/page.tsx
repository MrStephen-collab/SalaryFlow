import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { isSampleEmployeeNumber } from "@/lib/demo";
import { ThriftService } from "@/services/thrift-service";
import { ThriftInterestService } from "@/services/thrift-interest-service";
import { ThriftRequestActions } from "@/components/dashboard/employees/thrift-request-actions";
import { FundThriftButton } from "@/components/dashboard/employees/fund-thrift-button";
import { ThriftFundingControls } from "@/components/dashboard/employees/thrift-funding-controls";
import { ThriftInterestControls } from "@/components/dashboard/employees/thrift-interest-controls";
import { ThriftAmountEditor } from "@/components/dashboard/employees/thrift-amount-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";

export const metadata: Metadata = {
  title: "Thrift Savings",
};

export const dynamic = "force-dynamic";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function ThriftSavingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; interestMonth?: string }>;
}) {
  const { month, interestMonth } = await searchParams;
  const service = await ThriftService.create();
  const interestService = await ThriftInterestService.create();
  const [overview, requests, fundings, profile, interest] = await Promise.all([
    service.getOverview(month),
    service.listRequests(),
    service.listFundings(50),
    getProfile(),
    interestService.getOverview(interestMonth),
  ]);

  const canFund =
    profile?.role === "ORGANIZATION_OWNER" ||
    profile?.role === "ORGANIZATION_ADMIN";
  const canApprove = profile?.role === "ORGANIZATION_OWNER";

  const periodMonth = overview?.periodMonth ?? "";
  const eligibleEmployees = (overview?.employees ?? []).filter(
    (employee) => employee.enabled && employee.amount > 0
  );
  const unfundedEmployees = eligibleEmployees.filter(
    (employee) => !employee.fundedThisMonth
  );
  const corporateTotal = unfundedEmployees.reduce(
    (sum, employee) => sum + employee.amount,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Thrift Savings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record the monthly thrift withheld from employees&apos; salaries and
            track how each contribution is split between their active loan and
            savings. Each employee can only be funded once per month.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<Link href="/dashboard/reports/thrift" />}
          >
            View funding report
          </Button>
          <Button
            variant="outline"
            render={<Link href="/dashboard/reports/thrift-interest" />}
          >
            View interest report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total thrift savings</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {naira(overview?.totals.savings ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly thrift amount</CardDescription>
            <CardTitle className="text-2xl">
              {naira(overview?.totals.monthlyThrift ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Funded this month</CardDescription>
            <CardTitle className="text-2xl">
              {naira(overview?.totals.fundedThisMonth ?? 0)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {overview?.totals.fundedCount ?? 0} of{" "}
              {overview?.totals.employeeCount ?? 0} employees
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employees with active loans</CardDescription>
            <CardTitle className="text-2xl">
              {overview?.totals.activeLoans ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Thrift interest (YTD)</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {naira(interest?.totals.ytdInterest ?? 0)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {interest?.annualRate ?? 5}% p.a. ·{" "}
              {naira(interest?.totals.interest ?? 0)} in{" "}
              {interest?.periodLabel ?? "this month"}
            </p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Thrift Interest</CardTitle>
            <CardDescription>
              Interest is earned daily on each employee&apos;s opening thrift
              balance at {interest?.annualRate ?? 5}% per annum. The projected
              monthly figure is the sum of every day&apos;s growth; posted
              months are credited to savings and the ledger.
            </CardDescription>
          </div>
          <Badge variant={interest?.totals.posted ? "default" : "secondary"}>
            {interest?.totals.posted ?? 0} posted for{" "}
            {interest?.periodLabel ?? "this month"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Annual rate</p>
              <p className="mt-1 text-lg font-semibold">
                {interest?.annualRate ?? 5}%
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Interest posted</p>
              <p className="mt-1 text-lg font-semibold">
                {naira(interest?.totals.interest ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Employees posted</p>
              <p className="mt-1 text-lg font-semibold">
                {interest?.totals.posted ?? 0}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Interest YTD</p>
              <p className="mt-1 text-lg font-semibold">
                {naira(interest?.totals.ytdInterest ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Daily Interest Growth
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">
                {naira(interest?.live.accruedToDate ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Today +{naira(interest?.live.dailyGrowth ?? 0)} · Day{" "}
                {interest?.live.dayOfMonth ?? 0} of{" "}
                {interest?.live.daysInMonth ?? 0}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Projected Thrift Interest
              </p>
              <p className="mt-1 text-lg font-semibold">
                {naira(interest?.live.projected ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Month-end sum of daily growth
              </p>
            </div>
          </div>

          {interest ? (
            <ThriftInterestControls
              periodMonth={interest.periodMonth}
              annualRate={interest.annualRate}
              closed={interest.closed}
              postedCount={interest.totals.posted}
              canPost={canFund}
            />
          ) : null}

          {!interest || interest.accruals.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No interest posted for {interest?.periodLabel ?? "this month"}.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead className="text-right">Released</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={7} itemLabel="employees">
                  {interest.accruals.map((accrual) => (
                    <TableRow key={accrual.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{accrual.employeeName}</p>
                          {accrual.sample ? (
                            <Badge variant="outline">Sample</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {accrual.employeeNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(accrual.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(accrual.contributions)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(accrual.payouts)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {accrual.eligibleDays}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-emerald-600">
                        {naira(accrual.interest)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(accrual.closingBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          )}

          <div className="mt-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Interest payment history</p>
                <p className="text-xs text-muted-foreground">
                  Monthly interest sums credited to employees&apos; thrift
                  accounts and posted to the ledger.
                </p>
              </div>
              <Badge variant="outline">
                {interest?.history.length ?? 0} month
                {(interest?.history.length ?? 0) === 1 ? "" : "s"} posted
              </Badge>
            </div>
            {!interest || interest.history.length === 0 ? (
              <p className="rounded-md border py-4 text-center text-sm text-muted-foreground">
                No interest has been posted yet.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Employees</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Contribution</TableHead>
                      <TableHead className="text-right">Released</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <CollapsibleTableBody columns={7} itemLabel="months">
                    {interest.history.map((month) => (
                      <TableRow key={month.periodMonth}>
                        <TableCell className="text-sm font-medium">
                          {month.periodLabel}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {month.posted}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {naira(month.opening)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {naira(month.contributions)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {naira(month.payouts)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-emerald-600">
                          {naira(month.interest)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {naira(month.closing)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </CollapsibleTableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {canFund ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Corporate Funding</CardTitle>
              <CardDescription>
                Fund every eligible employee&apos;s agreed monthly thrift in one
                action. Employees already funded this month are skipped.
              </CardDescription>
            </div>
            <Badge variant={unfundedEmployees.length === 0 ? "default" : "secondary"}>
              {eligibleEmployees.filter((employee) => employee.fundedThisMonth).length}{" "}
              of {eligibleEmployees.length} eligible funded
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Employees to fund</p>
                <p className="mt-1 text-lg font-semibold">
                  {unfundedEmployees.length}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total to fund</p>
                <p className="mt-1 text-lg font-semibold">{naira(corporateTotal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Monthly thrift</p>
                <p className="mt-1 text-lg font-semibold">
                  {naira(overview?.totals.monthlyThrift ?? 0)}
                </p>
              </div>
            </div>

            {periodMonth ? (
              <ThriftFundingControls
                periodMonth={periodMonth}
                disabled={unfundedEmployees.length === 0}
              />
            ) : null}

            <p className="text-xs text-muted-foreground">
              Each employee can receive only one thrift funding per month. Use
              individual funding below when you need to fund one person at a time.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Individual Funding</CardTitle>
            <CardDescription>
              Fund one employee at a time. The contribution settles their
              active loan instalment first; the remainder is added to savings.
            </CardDescription>
          </div>
          <Badge variant="outline">One funding per month</Badge>
        </CardHeader>
        <CardContent>
          {!overview || overview.employees.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active employees yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Monthly Thrift</TableHead>
                    <TableHead className="text-right">Thrift Savings</TableHead>
                    <TableHead className="text-right">Loan Repayment</TableHead>
                    <TableHead>This Month</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={6} itemLabel="employees">
                  {overview.employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{employee.name}</p>
                          {isSampleEmployeeNumber(employee.employeeNumber) ? (
                            <Badge variant="outline">Sample</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {employee.employeeNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {canFund ? (
                          <ThriftAmountEditor
                            employeeId={employee.id}
                            employeeName={employee.name}
                            amount={employee.amount}
                            enabled={employee.enabled}
                          />
                        ) : employee.enabled ? (
                          <span className="text-sm">{naira(employee.amount)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Off</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-amber-600">
                        {naira(employee.balance)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {employee.activeLoanMonthly > 0
                          ? naira(employee.activeLoanMonthly)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {employee.fundedThisMonth ? (
                          <div>
                            <Badge variant="default">Funded</Badge>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {naira(employee.loanRepayment)} to loan ·{" "}
                              {naira(
                                employee.fundedAmount - employee.loanRepayment
                              )}{" "}
                              to savings
                            </p>
                          </div>
                        ) : (
                          <Badge variant="secondary">Not funded</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canFund ? (
                          <FundThriftButton
                            employeeId={employee.id}
                            periodMonth={periodMonth}
                            amount={employee.amount}
                            funded={employee.fundedThisMonth}
                            enabled={employee.enabled}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funding history</CardTitle>
          <CardDescription>
            Every employer contribution with its loan and savings split.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fundings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No thrift funding recorded yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">To Loan</TableHead>
                    <TableHead className="text-right">To Savings</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={7} itemLabel="fundings">
                  {fundings.map((funding) => (
                    <TableRow key={funding.id}>
                      <TableCell>
                        <p className="font-medium">{funding.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {funding.employeeNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {funding.periodLabel}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {naira(funding.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(funding.loanRepayment)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {naira(funding.thriftCredit)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {funding.reference}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/receipts/thrift/${funding.id}`} />}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release requests</CardTitle>
          <CardDescription>
            Employees ask to move part of their thrift savings into their
            withdrawable wallet. Only the chairman can approve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No thrift release requests yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={5} itemLabel="requests">
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <p className="font-medium">{request.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.employeeNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(request.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(request.createdAt).toLocaleDateString("en-NG")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.status === "PAID"
                              ? "default"
                              : request.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ThriftRequestActions
                          id={request.id}
                          status={request.status}
                          canApprove={canApprove}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </CollapsibleTableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
