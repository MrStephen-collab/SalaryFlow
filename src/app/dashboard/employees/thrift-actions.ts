"use server";

import { revalidatePath } from "next/cache";
import { ThriftService } from "@/services/thrift-service";

export async function releaseThriftToWallet(
  employeeId: string,
  amount?: number
) {
  const service = await ThriftService.create();
  const result = await service.releaseToWallet(employeeId, amount);
  if (result.ok) {
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function releaseAllThriftToWallets() {
  const service = await ThriftService.create();
  const result = await service.releaseAllToWallet();
  if (result.ok) {
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");
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
  }
  return result;
}
