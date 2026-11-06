import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import { LoanService } from "@/services/loan-service";
import { ThriftService } from "@/services/thrift-service";
import { WithdrawalService } from "@/services/withdrawal-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pending Approvals",
};

export const dynamic = "force-dynamic";

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
    case "PAID":
      return "default" as const;
    case "REJECTED":
    case "FAILED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function ApprovalsPage() {
  const [memberService, loanService, withdrawalService, thriftService] =
    await Promise.all([
      MemberService.createForStaff(),
      LoanService.create(),
      WithdrawalService.create(),
      ThriftService.create(),
    ]);

  const [members, memberApplications, applications, withdrawals, thriftRequests] =
    await Promise.all([
      memberService.listMembers(),
      memberService.listMemberApplications(),
      loanService.listApplications(),
      withdrawalService.listWithdrawals(),
      thriftService.listRequests(),
    ]);

  const pendingMemberships = members.filter(
    (member) => member.status !== "ACTIVE"
  );
  const pendingMemberLoans = memberApplications.filter((application) =>
    ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(application.status)
  );
  const pendingEmployeeLoans = applications.filter((application) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(application.status)
  );
  const pendingWithdrawals = withdrawals.filter((withdrawal) =>
    ["PENDING", "REVIEW"].includes(withdrawal.status)
  );
  const pendingThriftRequests = thriftRequests.filter(
    (request) => request.status === "PENDING"
  );

  const sections = [
    {
      title: "Member approvals",
      description: "Member accounts waiting for employer activation",
      href: "/dashboard/members",
      count: pendingMemberships.length,
      items: pendingMemberships.map((member) => ({
        id: member.id as string,
        primary: `${member.first_name} ${member.last_name}`,
        secondary: `${member.member_number} · ${member.email}`,
        amount: null as number | null,
        status: member.status as string,
      })),
      action: "Review members",
    },
    {
      title: "Member loan requests",
      description: "External member loans awaiting approval",
      href: "/dashboard/members/loans",
      count: pendingMemberLoans.length,
      items: pendingMemberLoans.map((application) => ({
        id: application.id as string,
        primary: application.memberName ?? "Member",
        secondary: application.memberNumber ?? "",
        amount: Number(application.amount) || 0,
        status: application.status as string,
      })),
      action: "Review member loans",
    },
    {
      title: "Employee loan applications",
      description: "Employee loans awaiting review or disbursement",
      href: "/dashboard/loans/applications",
      count: pendingEmployeeLoans.length,
      items: pendingEmployeeLoans.map((application) => ({
        id: application.id as string,
        primary: application.employeeName ?? "Employee",
        secondary: application.productName ?? "",
        amount: Number(application.amount) || 0,
        status: application.status as string,
      })),
      action: "Review employee loans",
    },
    {
      title: "Withdrawal requests",
      description: "Employee and member withdrawals awaiting action",
      href: "/dashboard/withdrawals",
      count: pendingWithdrawals.length,
      items: pendingWithdrawals.map((withdrawal) => ({
        id: withdrawal.id as string,
        primary:
          (withdrawal.employeeName as string | undefined) ?? "Withdrawal",
        secondary: (withdrawal.reference as string | undefined) ?? "",
        amount: Number(withdrawal.amount) || 0,
        status: withdrawal.status as string,
      })),
      action: "Review withdrawals",
    },
    {
      title: "Thrift release requests",
      description: "Employee thrift payouts awaiting chairman approval",
      href: "/dashboard/employees/thrift",
      count: pendingThriftRequests.length,
      items: pendingThriftRequests.map((request) => ({
        id: request.id,
        primary: request.employeeName,
        secondary: request.employeeNumber,
        amount: request.amount,
        status: request.status,
      })),
      action: "Review thrift requests",
    },
  ];

  const total = sections.reduce((sum, section) => sum + section.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pending Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} item{total === 1 ? "" : "s"} waiting across members, loans,
          withdrawals and thrift.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardDescription>{section.title}</CardDescription>
              <CardTitle className="text-2xl">{section.count}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="ghost"
                size="sm"
                className="px-0"
                render={<Link href={section.href} />}
              >
                {section.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link href={section.href} />}>
              Open
            </Button>
          </CardHeader>
          <CardContent>
            {section.items.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing pending here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {section.items.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.primary}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.secondary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.amount !== null ? (
                        <span className="font-mono text-sm">{naira(item.amount)}</span>
                      ) : null}
                      <Badge variant={statusVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
