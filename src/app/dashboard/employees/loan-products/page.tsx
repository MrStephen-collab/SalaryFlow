import type { Metadata } from "next";
import { LoanService } from "@/services/loan-service";
import { LoanProductsManager } from "@/components/dashboard/loans/loan-products-manager";

export const metadata: Metadata = {
  title: "Employee Loan Products",
};

export default async function EmployeeLoanProductsPage() {
  const service = await LoanService.create();
  const products = await service.listProducts("EMPLOYEE");

  return <LoanProductsManager products={products} scope="EMPLOYEE" />;
}
