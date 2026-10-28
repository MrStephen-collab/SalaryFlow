import type { Metadata } from "next";
import Link from "next/link";
import { SalaryService } from "@/services/salary-service";
import {
  Card,
  CardContent,
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
import { CreatePeriodDialog } from "@/components/dashboard/salary/create-period-dialog";
import { ArrowRight, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Salary",
};

function statusVariant(status: string) {
  switch (status) {
    case "DRAFT":
      return "secondary" as const;
    case "PROCESSING":
      return "secondary" as const;
    case "APPROVED":
      return "default" as const;
    case "PAID":
      return "default" as const;
    case "CLOSED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export default async function SalaryPage() {
  const service = await SalaryService.create();
  const periods = await service.listPeriods();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage salary periods and records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/dashboard/salary/import" />}>
            <FileText className="size-4" />
            Import Salary
          </Button>
          <CreatePeriodDialog />
        </div>
      </div>

      {periods.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No salary periods yet</p>
            <p className="text-sm text-muted-foreground">
              Create a salary period to begin recording salaries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={7} itemLabel="periods">
              {periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell>{period.start_date}</TableCell>
                  <TableCell>{period.end_date}</TableCell>
                  <TableCell>{period.payment_date}</TableCell>
                  <TableCell>
                    {period.salary_records?.[0]?.count ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(period.status)}>
                      {period.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/dashboard/salary/${period.id}`} />}
                    >
                      View
                      <ArrowRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </CollapsibleTableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
