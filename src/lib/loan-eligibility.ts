/**
 * Employee borrowing rules shared by the server and the loan application form.
 *
 * Thrift savings back employee loans: an employee can borrow up to three times
 * the thrift they have accumulated, capped separately by each loan product's
 * maximum. The monthly repayment must also fit inside the employee's agreed
 * monthly thrift amount, because the employer's monthly thrift funding settles
 * the loan.
 */
export const EMPLOYEE_LOAN_THRIFT_MULTIPLIER = 3;

export function thriftBackedLoanLimit(thriftBalance: number) {
  const balance = Number(thriftBalance) || 0;
  return Math.round(balance * EMPLOYEE_LOAN_THRIFT_MULTIPLIER * 100) / 100;
}

/** The monthly repayment cannot exceed what the employee saves each month. */
export function fitsMonthlyThrift(
  monthlyRepayment: number,
  thriftAmount: number
) {
  return (
    (Number(monthlyRepayment) || 0) <= (Number(thriftAmount) || 0) + 0.0001
  );
}
