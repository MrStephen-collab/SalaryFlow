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
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { NameSearch } from "@/components/dashboard/name-search";

export const metadata: Metadata = {
  title: "Member Repayments",
};

export const dynamic = "force-dynamic";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function MemberRepaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const service = await MemberService.createForStaff();
  const repayments = await service.listMemberRepayments();

  const term = (q ?? "").trim().toLowerCase();
  const filtered = term
    ? repayments.filter((item) =>
        `${item.memberName ?? ""} ${item.memberNumber ?? ""}`
          .toLowerCase()
          .includes(term)
      )
    : repayments;

  const total = repayments.reduce((sum, item) => sum + item.amount, 0);

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
        <h1 className="text-2xl font-bold tracking-tight">Member Repayments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instalments paid on member loans — principal rebuilds savings, interest
          is loan income.
        </p>
      </div>

      <div className="flex justify-end">
        <NameSearch placeholder="Search member name or number…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total repaid</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {naira(total)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Instalments paid</CardDescription>
            <CardTitle className="text-2xl">{repayments.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repayment history</CardTitle>
          <CardDescription>Paid member loan instalments</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {term
                ? "No member matches that name or number."
                : "No member repayments recorded yet."}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Instalment</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <CollapsibleTableBody columns={6} itemLabel="repayments">
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        {item.paidAt
                          ? new Date(item.paidAt).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
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
                        {naira(item.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === "PAID" ? "default" : "secondary"}
                        >
                          {item.status}
                        </Badge>
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
