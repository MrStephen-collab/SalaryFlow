"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword } from "@/app/employee/profile/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = () => {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await changePassword(currentPassword, newPassword);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Password updated");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput
          id="currentPassword"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat new password"
          autoComplete="new-password"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
      >
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </div>
  );
}