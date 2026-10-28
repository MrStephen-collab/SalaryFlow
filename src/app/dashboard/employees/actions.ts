"use server";

import { revalidatePath } from "next/cache";
import { EmployeeService } from "@/services/employee-service";
import { createEmployeeSchema, updateEmployeeSchema } from "@/schemas/employee";

export type ActionResult<T = undefined> = {
  error?: string;
  success?: string;
  data?: T;
};

export async function listEmployees(params: {
  search?: string;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const service = await EmployeeService.create();
    return await service.list(params);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to load employees"
    );
  }
}

export async function getEmployee(id: string) {
  try {
    const service = await EmployeeService.create();
    return await service.getById(id);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to load employee"
    );
  }
}

export async function createEmployee(
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = createEmployeeSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.[0] as string | undefined;
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const service = await EmployeeService.create();
    await service.createEmployee(parsed.data as unknown as Record<string, unknown>);

    revalidatePath("/dashboard/employees");
    return { success: "Employee created successfully" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create employee",
    };
  }
}

export async function updateEmployee(
  id: string,
  values: unknown
): Promise<ActionResult> {
  try {
    const object = (values ?? {}) as Record<string, unknown>;
    const parsed = updateEmployeeSchema.safeParse(object);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.[0] as string | undefined;
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const service = await EmployeeService.create();
    await service.updateEmployee(
      id,
      parsed.data as unknown as Record<string, unknown>
    );

    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/employees/${id}`);
    return { success: "Employee updated successfully" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to update employee",
    };
  }
}

export async function toggleEmployeeStatus(id: string): Promise<ActionResult> {
  try {
    const service = await EmployeeService.create();
    const newStatus = await service.suspendEmployee(id);

    revalidatePath("/dashboard/employees");
    return {
      success:
        newStatus === "Suspended"
          ? "Employee suspended"
          : "Employee reactivated",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to update employee",
    };
  }
}

export async function getDepartments() {
  const service = await EmployeeService.create();
  return service.listDepartments();
}

export async function getBranches() {
  const service = await EmployeeService.create();
  return service.listBranches();
}

export async function createDepartmentAction(
  name: string
): Promise<ActionResult> {
  try {
    if (!name.trim()) return { error: "Department name is required" };
    const service = await EmployeeService.create();
    await service.createDepartment(name.trim());
    revalidatePath("/dashboard/employees/departments");
    return { success: "Department created" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create department",
    };
  }
}

export async function createBranchAction(
  name: string,
  address?: string
): Promise<ActionResult> {
  try {
    if (!name.trim()) return { error: "Branch name is required" };
    const service = await EmployeeService.create();
    await service.createBranch(name.trim(), address);
    revalidatePath("/dashboard/employees/branches");
    return { success: "Branch created" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create branch",
    };
  }
}

export async function updateBranchAction(
  id: string,
  values: { name: string; address?: string }
): Promise<ActionResult> {
  try {
    if (!values.name.trim()) return { error: "Branch name is required" };
    const service = await EmployeeService.create();
    await service.updateBranch(id, values.name.trim(), values.address || undefined);
    revalidatePath("/dashboard/employees/branches");
    return { success: "Branch updated" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to update branch",
    };
  }
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  try {
    const service = await EmployeeService.create();
    await service.deleteBranch(id);
    revalidatePath("/dashboard/employees/branches");
    return { success: "Branch deleted" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to delete branch",
    };
  }
}

export async function updateDepartmentAction(
  id: string,
  name: string
): Promise<ActionResult> {
  try {
    if (!name.trim()) return { error: "Department name is required" };
    const service = await EmployeeService.create();
    await service.updateDepartment(id, name.trim());
    revalidatePath("/dashboard/employees/departments");
    return { success: "Department updated" };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to update department",
    };
  }
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  try {
    const service = await EmployeeService.create();
    await service.deleteDepartment(id);
    revalidatePath("/dashboard/employees/departments");
    return { success: "Department deleted" };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to delete department",
    };
  }
}
