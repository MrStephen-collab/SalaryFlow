"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMember } from "@/app/dashboard/members/actions";
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
import { NinDocumentInput } from "@/components/nin/nin-document-input";
import { Loader2, Pencil } from "lucide-react";

type MemberRecord = {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  nin: string | null;
  nin_document_url: string | null;
  loan_interest_rate: number | null;
};

function formFromMember(member: MemberRecord) {
  return {
    firstName: member.first_name ?? "",
    lastName: member.last_name ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    address: member.address ?? "",
    dateOfBirth: member.date_of_birth ?? "",
    nin: member.nin ?? "",
    ninDocumentUrl: member.nin_document_url ?? "",
    loanInterestRate:
      member.loan_interest_rate === null || member.loan_interest_rate === undefined
        ? ""
        : String(member.loan_interest_rate),
  };
}

export function EditMemberDialog({ member }: { member: MemberRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formFromMember(member));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setForm(formFromMember(member));
  }, [open, member]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email address is required");
      return;
    }
    if (form.nin && !/^\d{11}$/.test(form.nin)) {
      toast.error("NIN must be 11 digits");
      return;
    }

    startTransition(async () => {
      const result = await updateMember(member.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        nin: form.nin || undefined,
        ninDocumentUrl: form.ninDocumentUrl || undefined,
        loanInterestRate:
          form.loanInterestRate === "" ? null : Number(form.loanInterestRate),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Could not update the member");
        return;
      }

      toast.success("Member updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update the member&apos;s details, NIN and NIN document.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input
              value={form.firstName}
              onChange={(event) => set("firstName", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input
              value={form.lastName}
              onChange={(event) => set("lastName", event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => set("dateOfBirth", event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>NIN</Label>
            <Input
              value={form.nin}
              inputMode="numeric"
              maxLength={11}
              placeholder="11-digit NIN"
              onChange={(event) =>
                set("nin", event.target.value.replace(/\D/g, "").slice(0, 11))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>NIN Document</Label>
            <NinDocumentInput
              value={form.ninDocumentUrl || null}
              onChange={(url) => set("ninDocumentUrl", url ?? "")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Loan Interest Rate (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.loanInterestRate}
              onChange={(event) => set("loanInterestRate", event.target.value)}
              placeholder="Organization default (1%)"
            />
            <p className="text-xs text-muted-foreground">
              Overrides the organization&apos;s member loan rate for this account.
              Leave blank to use the default. 1% = ₦10 on every ₦1,000.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
