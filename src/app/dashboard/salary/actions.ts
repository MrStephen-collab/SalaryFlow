"use server";

import { revalidatePath } from "next/cache";
import { SalaryService } from "@/services/salary-service";
import { DisbursementService } from "@/services/disbursement-service";
import {
  createSalaryPeriodSchema,
  salaryImportSchema,
} from "@/schemas/salary";

export type ActionResult<T = undefined> = {
  error?: string;
  success?: string;
  data?: T;
};

export async function listSalaryPeriods() {
  const service = await SalaryService.create();
  return service.listPeriods();
}

export async function createSalaryPeriod(
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = createSalaryPeriodSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.[0] as string | undefined;
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const service = await SalaryService.create();
    await service.createPeriod(parsed.data);

    revalidatePath("/dashboard/salary");
    revalidatePath("/dashboard/salary/import");
    return { success: "Salary period created" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create period",
    };
  }
}

export async function getSalaryRecords(periodId: string) {
  try {
    const service = await SalaryService.create();
    return await service.getSalaryRecords(periodId);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to load records"
    );
  }
}

export async function importSalary(
  values: unknown
): Promise<ActionResult<{ imported: number }>> {  try {
    const parsed = salaryImportSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.slice(0, 2).join(".") as string | undefined;
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const service = await SalaryService.create();
    const rows = parsed.data.rows.map((r) => ({
      employeeNumber: r.employeeNumber,
      basicSalary: r.basicSalary,
      allowances: r.allowances,
      otherDeductions: r.otherDeductions,
    }));

    const data = await service.importSalaryRecords(parsed.data.periodId, rows);

    revalidatePath("/dashboard/salary");
    return {
      success: `Imported ${data?.length ?? 0} salary records`,
      data: { imported: data?.length ?? 0 },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to import salary",
    };
  }
}

/** Pay a salary period into employee wallets from the funded pool. */
export async function paySalaryPeriod(periodId: string) {
  try {
    const result = await DisbursementService.payPeriodNow(periodId);
    revalidatePath("/dashboard/salary");
    revalidatePath(`/dashboard/salary/${periodId}`);
    revalidatePath("/dashboard/funds");
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to run payroll",
    };
  }
}

export async function getDisbursementRun(periodId: string) {
  return DisbursementService.getRunForPeriod(periodId);
}

export async function getDisbursementRunItems(runId: string) {
  return DisbursementService.getRunItems(runId);
}
