"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestMemberWithdrawal } from "@/app/member/actions";
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
import { Loader2, Wallet } from "lucide-react";
import type { MemberBankAccount } from "./member-bank-accounts";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function MemberWithdrawalForm({
  max,
  accounts,
}: {
  max: number;
  accounts: MemberBankAccount[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (value > max) {
      toast.error(`You can withdraw up to ${naira(max)}`);
      return;
    }
    if (!bankAccountId) {
      toast.error("Select a bank account");
      return;
    }

    startTransition(async () => {
      const result = await requestMemberWithdrawal(value, bankAccountId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not submit the request");
        return;
      }
      toast.success(result.success ?? "Withdrawal request submitted");
      setAmount("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Withdraw to *</Label>
        {accounts.length === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Add a bank account first, then you can request a withdrawal.
          </p>
        ) : (
          <Select
            value={bankAccountId || undefined}
            onValueChange={(value) => setBankAccountId(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) => {
                  const selected = accounts.find((account) => account.id === value);
                  return selected
                    ? `${selected.bank_name} · ${selected.account_number}`
                    : "Select bank account";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.bank_name} · {account.account_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label>Amount (₦) *</Label>
        <Input
          type="number"
          min={1}
          max={max}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={`Up to ${naira(max)}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAmount(String(max))}
            disabled={max <= 0}
          >
            Withdraw full balance
          </Button>
          <p className="text-xs text-muted-foreground">
            Wallet balance: {naira(max)} · 100% withdrawable with chairman
            approval
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Requests are approved by the chairman before payment.
        </p>
      </div>
      <Button
        onClick={submit}
        disabled={isPending || max <= 0 || accounts.length === 0}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {isPending ? "Submitting…" : "Request withdrawal"}
      </Button>
    </div>
  );
}
