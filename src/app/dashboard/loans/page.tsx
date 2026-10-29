import type { Metadata } from "next";
import { LoanService } from "@/services/loan-service";
import { LoanProductsManager } from "@/components/dashboard/loans/loan-products-manager";

export const metadata: Metadata = {
  title: "Loans",
};

export default async function LoansPage() {
  const service = await LoanService.create();
  const products = await service.listProducts();

  return <LoanProductsManager products={products} />;
}
