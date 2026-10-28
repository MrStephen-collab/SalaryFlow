"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addBankAccount } from "@/app/employee/actions";
import type { BankAccountValues } from "@/schemas/withdrawal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

export function BankAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<BankAccountValues>({
    bankName: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });

  const handleAdd = () => {
    startTransition(async () => {
      const result = await addBankAccount(form);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Bank account added");
        setOpen(false);
        setForm({ bankName: "", bankCode: "", accountNumber: "", accountName: "" });
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Add Account
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
          <DialogDescription>
            Your account is stored securely. Full numbers are never shown after
            saving.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Bank Name *</Label>
            <Input
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="e.g. Access Bank"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Number *</Label>
            <Input
              value={form.accountNumber}
              onChange={(e) =>
                setForm({
                  ...form,
                  accountNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
              placeholder="10-digit account number"
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label>Account Name *</Label>
            <Input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              placeholder="Name on the account"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={
              isPending ||
              !form.bankName.trim() ||
              !/^\d{10}$/.test(form.accountNumber) ||
              !form.accountName.trim()
            }
          >
            {isPending ? "Saving..." : "Save Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}