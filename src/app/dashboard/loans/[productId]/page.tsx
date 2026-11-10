import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";
import { LoanService } from "@/services/loan-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { EditProductDialog } from "@/components/dashboard/loans/edit-product-dialog";
import { ToggleProductActive } from "@/components/dashboard/loans/toggle-product-active";

export const metadata: Metadata = {
  title: "Loan Product",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function LoanProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const service = await LoanService.create();
  const product = await service.getProduct(productId);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Loan product details and configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<BackLink href="/dashboard/loans" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <EditProductDialog product={product} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Terms</CardTitle>
            <CardDescription>Core product configuration</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Amount Range</p>
              <p className="text-sm font-medium">
                {naira(product.minimum_amount)} –{" "}
                {naira(product.maximum_amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest Rate</p>
              <p className="text-sm font-medium">
                {product.interest_rate}% ({product.interest_method})
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium">
                {product.duration_months} months
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Repayment Frequency
              </p>
              <p className="text-sm font-medium">
                {product.repayment_frequency}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Processing Fee</p>
              <p className="text-sm font-medium">
                {naira(product.processing_fee)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Insurance Fee</p>
              <p className="text-sm font-medium">
                {naira(product.insurance_fee)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligibility</CardTitle>
            <CardDescription>Requirements for employees</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Loan Limit</p>
              <p className="text-sm font-medium">3× thrift savings</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Min Employment Period
              </p>
              <p className="text-sm font-medium">
                {product.minimum_employment_period_months > 0
                  ? `${product.minimum_employment_period_months} months`
                  : "None"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requirements</p>
              <div className="mt-1 flex gap-2">
                {product.guarantor_required && (
                  <Badge variant="secondary">Guarantor</Badge>
                )}
                {product.collateral_required && (
                  <Badge variant="secondary">Collateral</Badge>
                )}
                {!product.guarantor_required &&
                  !product.collateral_required && (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Product availability</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Badge variant={product.active ? "default" : "secondary"}>
              {product.active ? "Active" : "Inactive"}
            </Badge>
            <ToggleProductActive
              productId={product.id}
              active={product.active}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
