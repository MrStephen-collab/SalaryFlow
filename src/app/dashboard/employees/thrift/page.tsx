import type { Metadata } from "next";
import { ThriftService } from "@/services/thrift-service";
import { ThriftRequestActions } from "@/components/dashboard/employees/thrift-request-actions";
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

export const metadata: Metadata = {
  title: "Thrift Requests",
};

export const dynamic = "force-dynamic";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function ThriftRequestsPage() {
  const service = await ThriftService.create();
  const requests = await service.listRequests();
  const pending = requests.filter((request) => request.status === "PENDING");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Thrift Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Employees ask to release their thrift savings. Each request is released
          individually and moves the amount into their withdrawable wallet.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending requests</CardDescription>
            <CardTitle className="text-2xl">{pending.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending amount</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {naira(pending.reduce((sum, request) => sum + request.amount, 0))}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release requests</CardTitle>
          <CardDescription>
            Approving releases that employee&apos;s requested amount to their
            wallet.
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
                <TableBody>
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
    </div>
  );
}
