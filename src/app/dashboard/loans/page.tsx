import type { Metadata } from "next";
import Link from "next/link";
import { LoanService } from "@/services/loan-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Contact, HandCoins, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Loan Products",
};

export default async function LoanProductsDirectoryPage() {
  const service = await LoanService.create();
  const [employeeProducts, memberProducts] = await Promise.all([
    service.listProducts("EMPLOYEE"),
    service.listProducts("MEMBER"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loan Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the product catalogue you want to manage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Employee Loan Products
            </CardTitle>
            <CardDescription>
              Products and terms available to employees during loan application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {employeeProducts.length === 0
                ? "No employee loan products yet."
                : `${employeeProducts.length} product${
                    employeeProducts.length === 1 ? "" : "s"
                  }: ${employeeProducts
                    .map((product) => product.name)
                    .join(", ")}`}
            </p>
            <Button render={<Link href="/dashboard/employees/loan-products" />}>
              <HandCoins className="size-4" />
              Manage employee products
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Contact className="size-4 text-primary" />
              Member Loan Product
            </CardTitle>
            <CardDescription>
              Terms used for external member savings-backed loans.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {memberProducts.length === 0
                ? "No member loan product yet."
                : `Product: ${memberProducts
                    .map((product) => product.name)
                    .join(", ")}`}
            </p>
            <Button
              variant="outline"
              render={<Link href="/dashboard/members/loan-products" />}
            >
              <HandCoins className="size-4" />
              Manage member product
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
