"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestWithdrawal } from "@/app/employee/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Banknote, AlertCircle, Lock } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function RequestWithdrawalForm({
  accounts,
  balance,
}: {
  accounts: {
    id: string;
    bankName: string;
    masked: string;
    accountName: string;
  }[];
  balance: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(0);
  const [bankAccountId, setBankAccountId] = useState("");
  const [pin, setPin] = useState("");

  const exceedsBalance = amount > balance;

  const handleSubmit = () => {
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!bankAccountId) {
      toast.error("Select a bank account");
      return;
    }
    if (exceedsBalance) {
      toast.error("Amount exceeds your available balance");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter your 4-digit withdrawal PIN");
      return;
    }

    startTransition(async () => {
      const result = await requestWithdrawal(amount, bankAccountId, pin);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Withdrawal requested");
        setAmount(0);
        setBankAccountId("");
        setPin("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label>Amount (₦)</Label>
        <Input
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          min={1}
          placeholder="0.00"
        />
        <p className="text-xs text-muted-foreground">
          Available: {naira(balance)}
        </p>
        {exceedsBalance && amount > 0 && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="size-3" />
            Amount exceeds your available balance.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Bank Account</Label>
        <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.bankName} · {account.masked} ({account.accountName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Withdrawal PIN</Label>
        <Input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="4-digit PIN"
        />
        <p className="text-xs text-muted-foreground">
          <Lock className="mr-1 inline size-3" />
          Set your PIN from your profile if you don&apos;t have one yet.
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={
          isPending ||
          amount <= 0 ||
          !bankAccountId ||
          exceedsBalance ||
          pin.length !== 4 ||
          accounts.length === 0
        }
        className="w-full"
      >
        <Banknote className="size-4" />
        {isPending ? "Submitting..." : "Request Withdrawal"}
      </Button>

      {accounts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add a bank account below before requesting a withdrawal.
        </p>
      )}
    </div>
  );
}