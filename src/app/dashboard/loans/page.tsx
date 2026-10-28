import type { Metadata } from "next";
import { LoanService } from "@/services/loan-service";
import {
  Card,
  CardContent,
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
import { CreateProductDialog } from "@/components/dashboard/loans/create-product-dialog";
import {
  ManageLoanProduct,
  type LoanProduct,
} from "@/components/dashboard/loans/manage-loan-product";

export const metadata: Metadata = {
  title: "Loans",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function LoansPage() {
  const service = await LoanService.create();
  const products = await service.listProducts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage loan products available to employees
          </p>
        </div>
        <CreateProductDialog />
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No loan products yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first loan product to start offering loans.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Amount Range</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Max Deduction</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {naira(product.minimum_amount)} – {naira(product.maximum_amount)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{product.interest_rate}%</span>
                      <span className="ml-1 text-muted-foreground">
                        ({product.interest_method === "FLAT"
                          ? "Flat"
                          : product.interest_method === "REDUCING_BALANCE"
                            ? "Reducing"
                            : "Amortized"})
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {product.duration_months} mo
                  </TableCell>
                  <TableCell className="text-sm">
                    {product.maximum_salary_deduction_percentage}%
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {product.guarantor_required && (
                        <Badge variant="secondary" className="text-xs">
                          Guarantor
                        </Badge>
                      )}
                      {product.collateral_required && (
                        <Badge variant="secondary" className="text-xs">
                          Collateral
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ManageLoanProduct product={product as LoanProduct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
