/**
 * Demo/sample data helpers.
 *
 * The demo seeder creates employees with a `DEMO-` employee number. Anything
 * derived from those records should be clearly labelled as sample data so it is
 * never mistaken for a real savings or interest posting.
 */
export const SAMPLE_EMPLOYEE_PREFIX = "DEMO-";

export function isSampleEmployeeNumber(
  employeeNumber: string | null | undefined
) {
  return Boolean(
    employeeNumber &&
      employeeNumber.toUpperCase().startsWith(SAMPLE_EMPLOYEE_PREFIX)
  );
}
