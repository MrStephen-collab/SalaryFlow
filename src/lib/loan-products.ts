/**
 * Loan products live in one table, but members and employees use different
 * products. The member savings loan keeps its reserved name so it can be
 * found reliably by the member portal. Everything else is an employee product.
 */
export const MEMBER_LOAN_PRODUCT_NAME = "Member Savings Loan";

export function isMemberLoanProductName(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase() === MEMBER_LOAN_PRODUCT_NAME.toLowerCase();
}

export function isMemberLoanProduct(product: { name?: string | null }) {
  return isMemberLoanProductName(product.name);
}

export function isEmployeeLoanProduct(product: { name?: string | null }) {
  return !isMemberLoanProduct(product);
}
