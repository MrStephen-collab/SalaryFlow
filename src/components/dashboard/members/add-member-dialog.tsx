"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addMember } from "@/app/dashboard/members/actions";
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
import { Check, Copy, Plus, UserPlus } from "lucide-react";
import { NinDocumentInput } from "@/components/nin/nin-document-input";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  dateOfBirth: "",
  nin: "",
  ninDocumentUrl: "",
};

export function AddMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(emptyForm);
    setCredentials(null);
    setCopied(false);
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
    if (!/^\d{11}$/.test(form.nin)) {
      toast.error("Enter the member's 11-digit NIN");
      return;
    }
    if (!form.ninDocumentUrl) {
      toast.error("Upload the member's NIN document");
      return;
    }

    startTransition(async () => {
      const result = await addMember({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        nin: form.nin,
        ninDocumentUrl: form.ninDocumentUrl,
      });

      if (!result.ok) {
        toast.error(result.error ?? "Could not add the member");
        return;
      }

      toast.success("Member added");
      setCredentials({
        email: form.email.trim().toLowerCase(),
        password: result.tempPassword ?? "",
      });
      router.refresh();
    });
  }

  async function copyCredentials() {
    if (!credentials) return;
    const text = `Email: ${credentials.email}\nTemporary password: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Login details copied");
    } catch {
      toast.error("Could not copy. Please copy the details manually.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" />
            Add Member
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add External Member</DialogTitle>
          <DialogDescription>
            Members are not employees. They save with your organization and can
            borrow after the membership period you configured.
          </DialogDescription>
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
              <p className="font-medium">Member account created</p>
              <p className="mt-1 text-green-800">
                Share these details with the member. The temporary password is
                shown only once.
              </p>
              <div className="mt-3 space-y-1 rounded-md bg-white/70 p-3 font-mono text-xs text-green-950">
                <p>Email: {credentials.email}</p>
                <p>Password: {credentials.password}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={copyCredentials}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copied" : "Copy details"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The member signs in at the normal login page and is taken straight
              to their savings portal. They should change this password after
              their first sign-in.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                }}
              >
                <Plus className="size-4" />
                Add another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={form.firstName}
                  onChange={(event) => set("firstName", event.target.value)}
                  placeholder="e.g. Ada"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={form.lastName}
                  onChange={(event) => set("lastName", event.target.value)}
                  placeholder="e.g. Okafor"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                  placeholder="member@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                  placeholder="0801 234 5678"
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
                  placeholder="Street, city, state"
                />
              </div>
              <div className="space-y-2">
                <Label>NIN *</Label>
                <Input
                  value={form.nin}
                  onChange={(event) =>
                    set("nin", event.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  placeholder="11-digit NIN"
                  inputMode="numeric"
                  maxLength={11}
                />
              </div>
              <div className="space-y-2">
                <Label>NIN Document *</Label>
                <NinDocumentInput
                  value={form.ninDocumentUrl || null}
                  onChange={(url) => set("ninDocumentUrl", url ?? "")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Creating…" : "Create member"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
