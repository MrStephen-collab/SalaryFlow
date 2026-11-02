/**
 * Employee borrowing rules shared by the server and the loan application form.
 *
 * Thrift savings back employee loans: an employee can borrow up to twice the
 * thrift they have saved, capped separately by each loan product's maximum.
 */
export const EMPLOYEE_LOAN_THRIFT_MULTIPLIER = 2;

export function thriftBackedLoanLimit(thriftBalance: number) {
  const balance = Number(thriftBalance) || 0;
  return Math.round(balance * EMPLOYEE_LOAN_THRIFT_MULTIPLIER * 100) / 100;
}
