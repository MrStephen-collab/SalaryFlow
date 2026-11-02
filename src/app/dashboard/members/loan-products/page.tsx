import type { Metadata } from "next";
import { LoanService } from "@/services/loan-service";
import { LoanProductsManager } from "@/components/dashboard/loans/loan-products-manager";

export const metadata: Metadata = {
  title: "Member Loan Product",
};

export default async function MemberLoanProductsPage() {
  const service = await LoanService.create();
  const products = await service.listProducts("MEMBER");

  return <LoanProductsManager products={products} scope="MEMBER" />;
}
