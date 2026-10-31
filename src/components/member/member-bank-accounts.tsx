"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addMemberBankAccount,
  removeMemberBankAccount,
} from "@/app/member/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";

export type MemberBankAccount = {
  id: string;
  bank_name: string;
  bank_code: string | null;
  account_number: string;
  account_name: string;
  is_default: boolean | null;
};

export function MemberBankAccounts({
  accounts,
}: {
  accounts: MemberBankAccount[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    bankName: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      toast.error("Fill in the bank, account number and account name");
      return;
    }
    if (!/^\d{10}$/.test(form.accountNumber.trim())) {
      toast.error("Account number must be 10 digits");
      return;
    }

    startTransition(async () => {
      const result = await addMemberBankAccount({
        bankName: form.bankName.trim(),
        bankCode: form.bankCode.trim() || undefined,
        accountNumber: form.accountNumber.trim(),
        accountName: form.accountName.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not add the account");
        return;
      }
      toast.success(result.success ?? "Bank account added");
      setOpen(false);
      setForm({ bankName: "", bankCode: "", accountNumber: "", accountName: "" });
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeMemberBankAccount(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not remove the account");
        return;
      }
      toast.success("Bank account removed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a bank account to receive withdrawals.
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  {account.bank_name}
                  {account.is_default ? (
                    <Badge variant="secondary">Default</Badge>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {account.account_number} · {account.account_name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(account.id)}
                disabled={isPending}
                aria-label={`Remove ${account.bank_name} account`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              Add bank account
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add bank account</DialogTitle>
            <DialogDescription>
              Withdrawals are paid into the account you select.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Bank name *</Label>
              <Input
                value={form.bankName}
                onChange={(event) => set("bankName", event.target.value)}
                placeholder="e.g. GTBank"
              />
            </div>
            <div className="space-y-2">
              <Label>Bank code</Label>
              <Input
                value={form.bankCode}
                onChange={(event) => set("bankCode", event.target.value)}
                placeholder="e.g. 058"
              />
            </div>
            <div className="space-y-2">
              <Label>Account number *</Label>
              <Input
                value={form.accountNumber}
                onChange={(event) =>
                  set("accountNumber", event.target.value.replace(/\D/g, "").slice(0, 10))
                }
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit account number"
              />
            </div>
            <div className="space-y-2">
              <Label>Account name *</Label>
              <Input
                value={form.accountName}
                onChange={(event) => set("accountName", event.target.value)}
                placeholder="Name on the account"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isPending ? "Saving…" : "Save account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
