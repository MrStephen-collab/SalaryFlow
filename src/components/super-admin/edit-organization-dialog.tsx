"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganization } from "@/app/super-admin/actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/schemas/settings";
import { ORGANIZATION_TYPES } from "@/config/constants";
import { Pencil } from "lucide-react";

export type Organization = {
  id: string;
  name: string;
  type: string;
  registration_number: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  state: string | null;
  lga: string | null;
  currency: string;
};

export function EditOrganizationDialog({
  organization,
}: {
  organization: Organization;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(() => ({
    name: organization.name,
    type: organization.type,
    registrationNumber: organization.registration_number ?? "",
    email: organization.email,
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    state: organization.state ?? "",
    lga: organization.lga ?? "",
    currency: organization.currency,
  }));

  function set<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm({
        name: organization.name,
        type: organization.type,
        registrationNumber: organization.registration_number ?? "",
        email: organization.email,
        phone: organization.phone ?? "",
        address: organization.address ?? "",
        state: organization.state ?? "",
        lga: organization.lga ?? "",
        currency: organization.currency,
      });
    }
    setOpen(next);
  }

  function save() {
    startTransition(async () => {
      const result = await updateOrganization(organization.id, {
        ...form,
        registrationNumber: form.registrationNumber.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update {organization.name}&apos;s profile details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Organization Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Currency *</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => set("currency", v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Registration Number</Label>
            <Input
              value={form.registrationNumber}
              onChange={(e) => set("registrationNumber", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>LGA</Label>
            <Input
              value={form.lga}
              onChange={(e) => set("lga", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
