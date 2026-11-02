import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
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
  title: "Member Collections",
};

export const dynamic = "force-dynamic";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function MemberCollectionsPage() {
  const service = await MemberService.createForStaff();
  const overdue = await service.listMemberOverdue();

  const total = overdue.reduce((sum, item) => sum + item.outstanding, 0);

  return (
    <div className="flex flex-col gap-6">
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
        <h1 className="text-2xl font-bold tracking-tight">Member Collections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overdue member loan instalments that still need to be collected.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding overdue</CardDescription>
            <CardTitle className="text-2xl text-red-600">{naira(total)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue instalments</CardDescription>
            <CardTitle className="text-2xl">{overdue.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overdue instalments</CardTitle>
          <CardDescription>
            Record a repayment from Member Loans once the member pays.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overdue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No overdue member instalments. All caught up.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Instalment</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.memberNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">#{item.month}</TableCell>
                      <TableCell className="text-sm">
                        {item.dueDate
                          ? new Date(item.dueDate).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {naira(item.amountDue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">
                        {naira(item.outstanding)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "LATE" ? "destructive" : "secondary"
                          }
                        >
                          {item.status}
                        </Badge>
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
