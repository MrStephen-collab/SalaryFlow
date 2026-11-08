"use server";

import { revalidatePath } from "next/cache";
import { ThriftService } from "@/services/thrift-service";
import { ThriftInterestService } from "@/services/thrift-interest-service";

export async function fundThrift(
  employeeId: string,
  periodMonth: string,
  amount?: number
) {
  const service = await ThriftService.create();
  const result = await service.fundEmployee(employeeId, periodMonth, amount);
  if (result.ok) {
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/employee/money");
  }
  return result;
}

export async function updateEmployeeThriftAmount(
  employeeId: string,
  amount: number
) {
  const service = await ThriftService.create();
  const result = await service.updateEmployeeThriftAmount(employeeId, amount);
  if (result.ok) {
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function fundAllThrift(periodMonth: string) {
  const service = await ThriftService.create();
  const result = await service.fundAll(periodMonth);
  if (result.ok) {
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/employee/money");
  }
  return result;
}

export async function releaseThriftToWallet(
  employeeId: string,
  amount?: number
) {
  const service = await ThriftService.create();
  const result = await service.releaseToWallet(employeeId, amount);
  if (result.ok) {
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/employee/money");
  }
  return result;
}

export async function releaseAllThriftToWallets() {
  const service = await ThriftService.create();
  const result = await service.releaseAllToWallet();
  if (result.ok) {
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/employee/money");
  }
  return result;
}

export async function reviewThriftRequest(
  id: string,
  approve: boolean,
  notes?: string
) {
  const service = await ThriftService.create();
  const result = await service.reviewRequest(id, approve, notes);
  if (result.ok) {
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/employee/money");
  }
  return result;
}

export async function postThriftInterest(periodMonth: string) {
  const service = await ThriftInterestService.create();
  const result = await service.postMonth(periodMonth);
  if (result.ok) {
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reports/thrift-interest");
    revalidatePath("/employee");
    revalidatePath("/employee/money");
    revalidatePath("/employee/statement");
  }
  return result;
}

export async function recalculateThriftInterest(periodMonth: string) {
  const service = await ThriftInterestService.create();
  const result = await service.recalculateFrom(periodMonth);
  if (result.ok) {
    revalidatePath("/dashboard/employees/thrift");
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reports/thrift-interest");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/employee");
    revalidatePath("/employee/money");
    revalidatePath("/employee/statement");
  }
  return result;
}
