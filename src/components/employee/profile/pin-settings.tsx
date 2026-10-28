"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setWithdrawalPin } from "@/app/employee/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function PinSettings({ hasPin }: { hasPin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  const handleSubmit = () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (hasPin && !/^\d{4}$/.test(currentPin)) {
      toast.error("Enter your current PIN");
      return;
    }

    startTransition(async () => {
      const result = await setWithdrawalPin(pin, hasPin ? currentPin : undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Withdrawal PIN saved");
        setPin("");
        setCurrentPin("");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={hasPin ? "default" : "outline"}>
          {hasPin ? "PIN set" : "PIN not set"}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Required before you can request a withdrawal.
        </p>
      </div>

      {hasPin && (
        <div className="space-y-2">
          <Label>Current PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Current 4-digit PIN"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>{hasPin ? "New PIN" : "Set PIN"}</Label>
        <Input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="4-digit PIN"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending || pin.length !== 4 || (hasPin && currentPin.length !== 4)}
      >
        {isPending ? "Saving..." : hasPin ? "Change PIN" : "Set PIN"}
      </Button>
    </div>
  );
}