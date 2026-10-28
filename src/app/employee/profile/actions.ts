"use server";

import { ProfileService } from "@/services/profile-service";

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success?: string; error?: string }> {
  const service = await ProfileService.create();
  return service.changePassword(currentPassword, newPassword);
}

export async function uploadAvatar(
  file: File
): Promise<{ success?: string; error?: string; url?: string }> {
  const service = await ProfileService.create();
  return service.uploadAvatar(file);
}

export async function setWithdrawalPin(
  pin: string,
  currentPin?: string
): Promise<{ success?: string; error?: string }> {
  const service = await ProfileService.create();
  return service.setWithdrawalPin(pin, currentPin);
}

export async function verifyWithdrawalPin(
  pin: string
): Promise<{ ok?: boolean; error?: string }> {
  const service = await ProfileService.create();
  return service.verifyWithdrawalPin(pin);
}

export async function hasWithdrawalPin(): Promise<boolean> {
  const service = await ProfileService.create();
  return service.hasWithdrawalPin();
}