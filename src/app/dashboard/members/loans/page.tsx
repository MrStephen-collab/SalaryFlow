import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import { MemberLoanActions } from "@/components/dashboard/members/member-loan-actions";
import { MemberRepaymentDialog } from "@/components/dashboard/members/member-repayment-dialog";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Member Loans",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
    case "COMPLETED":
      return "default" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function MemberLoansPage() {
  const service = await MemberService.createForStaff();
  const [applications, activeLoans, members, pool] = await Promise.all([
    service.listMemberApplications(),
    service.listActiveMemberLoans(),
    service.listMembers(),
    service.getMemberLoanPoolInfo(),
  ]);

  const pending = applications.filter((application) =>
    ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(application.status)
  );
  const approved = applications.filter(
    (application) => application.status === "APPROVED"
  );

  const totalOutstanding = activeLoans.reduce(
    (sum, loan) => sum + loan.outstanding,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<Link href="/dashboard/members" />}
          >
            <ArrowLeft className="size-4" />
            Back to members
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Member Loans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            External member lending — separate from employee loans.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending requests</CardDescription>
            <CardTitle className="text-2xl">{pending.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active loans</CardDescription>
            <CardTitle className="text-2xl">{activeLoans.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total outstanding</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {naira(totalOutstanding)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan requests</CardTitle>
          <CardDescription>
            Approving credits the principal into the member&apos;s wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pending member loan requests.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Repayment</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <p className="font-medium">{application.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.memberNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(Number(application.amount))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(Number(application.total_repayment))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {application.submitted_at
                          ? new Date(application.submitted_at).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberLoanActions
                          applicationId={application.id}
                          status={application.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approved — awaiting disbursement</CardTitle>
          <CardDescription>
            Approved loans are only paid out after the Member Loan Pool is
            funded.
            {pool
              ? ` Pool balance: ${naira(pool.balance)}.`
              : " No Member Loan Pool exists yet — create and fund one in Fund Management."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No approved loans waiting to be disbursed.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Repayment</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <p className="font-medium">{application.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.memberNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(Number(application.amount))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(Number(application.total_repayment))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {application.submitted_at
                          ? new Date(application.submitted_at).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberLoanActions
                          applicationId={application.id}
                          status={application.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active member loans</CardTitle>
          <CardDescription>
            Record repayments — principal rebuilds savings, interest is loan income.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeLoans.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active member loans.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Loan</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLoans.map((loan) => {
                    const progress =
                      loan.total > 0
                        ? Math.min(
                            100,
                            Math.round((loan.paid / loan.total) * 1000) / 10
                          )
                        : 0;
                    return (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <p className="font-medium">{loan.memberName}</p>
                          <p className="text-xs text-muted-foreground">
                            {loan.memberNumber}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {naira(loan.amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {naira(loan.outstanding)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {progress}% repaid
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {naira(loan.monthly)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              render={
                                <Link
                                  href={`/dashboard/members/loans/${loan.id}`}
                                />
                              }
                            >
                              Analysis
                            </Button>
                            <MemberRepaymentDialog
                              applicationId={loan.id}
                              memberName={loan.memberName}
                              outstanding={loan.outstanding}
                              monthly={loan.monthly}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All member loan applications</CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
            {applications.length} application{applications.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No member loan applications yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Repayment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <p className="font-medium">{application.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.memberNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(Number(application.amount))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(Number(application.total_repayment))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(application.status)}>
                          {application.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {application.submitted_at
                          ? new Date(application.submitted_at).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
