"use server";

import { revalidatePath } from "next/cache";
import { MemberService } from "@/services/member-service";

export async function listMembers(search?: string) {
  const service = await MemberService.createForStaff();
  return service.listMembers(search);
}

export async function addMember(values: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  nin?: string;
  ninDocumentUrl?: string;
}) {
  const service = await MemberService.createForStaff();
  const result = await service.addMember(values);
  if (result.ok) {
    revalidatePath("/dashboard/members");
  }
  return result;
}

export async function listMemberApplications() {
  const service = await MemberService.createForStaff();
  return service.listMemberApplications();
}

export async function approveMemberLoan(applicationId: string) {
  const service = await MemberService.createForStaff();
  const result = await service.approveApplication(applicationId);
  revalidatePath("/dashboard/members");
  return result;
}
export async function approveMemberMembership(memberId: string) {
  const service = await MemberService.createForStaff();
  const result = await service.approveMembership(memberId);
  revalidatePath("/dashboard/members");
  return result;
}

export async function recordMemberRepayment(
  applicationId: string,
  amount: number
) {
  const service = await MemberService.createForStaff();
  const result = await service.recordMemberRepayment(applicationId, amount);
  if (result.ok) {
    revalidatePath("/dashboard/members");
  }
  return result;
}

export async function approveMemberWithdrawal(withdrawalId: string) {
  const service = await MemberService.createForStaff();
  const result = await service.approveMemberWithdrawal(withdrawalId);
  revalidatePath("/dashboard/members");
  return result;
}

export async function payMemberWithdrawal(withdrawalId: string) {
  const service = await MemberService.createForStaff();
  const result = await service.payMemberWithdrawal(withdrawalId);
  revalidatePath("/dashboard/members");
  return result;
}

export async function updateMember(
  memberId: string,
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    nin?: string;
    ninDocumentUrl?: string;
  }
) {
  const service = await MemberService.createForStaff();
  const result = await service.updateMember(memberId, values);
  if (result.ok) {
    revalidatePath("/dashboard/members");
  }
  return result;
}

export async function rejectMemberLoan(applicationId: string, reason: string) {
  const service = await MemberService.createForStaff();
  const result = await service.rejectApplication(applicationId, reason);
  revalidatePath("/dashboard/members");
  return result;
}
