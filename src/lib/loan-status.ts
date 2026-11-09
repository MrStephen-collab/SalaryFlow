export type LoanStatusTone =
  | "default"
  | "secondary"
  | "outline"
  | "destructive";

/** Friendly status text shown to employees and members. */
export function loanStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Applying";
    case "UNDER_REVIEW":
      return "Under Review";
    case "ELIGIBILITY_FAILED":
      return "Not Eligible";
    case "APPROVED":
      return "Approved";
    case "READY_FOR_DISBURSEMENT":
      return "Waiting Disbursement";
    case "DISBURSED":
    case "ACTIVE":
      return "Active";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    case "DEFAULTED":
      return "Defaulted";
    case "CANCELLED":
      return "Cancelled";
    case "RESTRUCTURED":
      return "Restructured";
    default:
      return "No Active Loan";
  }
}

/** Longer helper text for the employee dashboard. */
export function loanStatusDescription(status: string | null | undefined) {
  switch (status) {
    case "SUBMITTED":
      return "Your application has been submitted and is waiting for review.";
    case "UNDER_REVIEW":
      return "Your application is being reviewed by the chairman.";
    case "APPROVED":
      return "Your loan is approved and waiting for disbursement.";
    case "READY_FOR_DISBURSEMENT":
      return "Your loan is ready — the chairman still needs to disburse it.";
    case "DISBURSED":
    case "ACTIVE":
      return "Your loan is active. Repayments are scheduled.";
    case "COMPLETED":
      return "You have fully repaid this loan.";
    case "REJECTED":
      return "Your loan application was declined.";
    case "DEFAULTED":
      return "This loan is marked as defaulted.";
    case "CANCELLED":
      return "This loan application was cancelled.";
    case "RESTRUCTURED":
      return "This loan has been restructured.";
    default:
      return "You have no loan in progress.";
  }
}

export function loanStatusTone(status: string | null | undefined): LoanStatusTone {
  switch (status) {
    case "APPROVED":
    case "READY_FOR_DISBURSEMENT":
    case "ACTIVE":
    case "DISBURSED":
    case "COMPLETED":
      return "default";
    case "REJECTED":
    case "DEFAULTED":
      return "destructive";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "secondary";
    default:
      return "outline";
  }
}

const IN_PROGRESS_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "READY_FOR_DISBURSEMENT",
  "DISBURSED",
  "ACTIVE",
]);

export function isLoanInProgress(status: string | null | undefined) {
  return Boolean(status && IN_PROGRESS_STATUSES.has(status));
}

export function isLoanActive(status: string | null | undefined) {
  return status === "ACTIVE" || status === "DISBURSED";
}
