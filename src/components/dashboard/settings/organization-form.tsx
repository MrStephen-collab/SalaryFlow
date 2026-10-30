"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganization } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/schemas/settings";
import { ORGANIZATION_TYPES } from "@/config/constants";
import { NinDocumentInput } from "@/components/nin/nin-document-input";
import type { Organization } from "@/types/database";

export function OrganizationForm({ organization }: { organization: Organization | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: organization?.name ?? "",
    type: organization?.type ?? "Company",
    registrationNumber: organization?.registration_number ?? "",
    email: organization?.email ?? "",
    phone: organization?.phone ?? "",
    address: organization?.address ?? "",
    state: organization?.state ?? "",
    lga: organization?.lga ?? "",
    nin: organization?.nin ?? "",
    ninDocumentUrl: organization?.nin_document_url ?? "",
    currency: organization?.currency ?? "NGN",
  });

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K] | null
  ) =>
    setForm((prev) => ({
      ...prev,
      [key]: value ?? prev[key],
    }));

  const onSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Organization name is required");
      return;
    }
    if (!/^\d{11}$/.test(form.nin)) {
      toast.error("Enter the organization owner's 11-digit NIN");
      return;
    }
    if (!form.ninDocumentUrl) {
      toast.error("Upload the organization owner's NIN document");
      return;
    }
    startTransition(async () => {
      const result = await updateOrganization(form);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Profile</CardTitle>
        <CardDescription>
          Basic details about your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Organization Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Acme Ltd"
            />
          </div>

          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={form.type}
              onValueChange={(v) => set("type", v)}
            >
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
              onValueChange={(v) => set("currency", v)}
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
            <Label>Registration Number</Label>
            <Input
              value={form.registrationNumber}
              onChange={(e) => set("registrationNumber", e.target.value)}
              placeholder="e.g. RC 1234567"
            />
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="info@acme.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          <div className="space-y-2">
            <Label>State</Label>
            <Input
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
              placeholder="Lagos"
            />
          </div>

          <div className="space-y-2">
            <Label>LGA</Label>
            <Input
              value={form.lga}
              onChange={(e) => set("lga", e.target.value)}
              placeholder="Ikeja"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div className="space-y-2">
            <Label>NIN *</Label>
            <Input
              value={form.nin}
              onChange={(e) =>
                set("nin", e.target.value.replace(/\D/g, "").slice(0, 11))
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

        <div className="mt-6 flex justify-end">
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? "Saving..." : "Save Organization"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}