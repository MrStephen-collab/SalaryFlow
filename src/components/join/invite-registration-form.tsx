"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerViaInvite, type InviteKind } from "@/app/join/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { NIGERIA_STATES, getLgasForState } from "@/config/nigeria";

type FormState = {
  firstName: string;
  lastName: string;
  otherNames: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  state: string;
  lga: string;
  nin: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  otherNames: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  state: "",
  lga: "",
  nin: "",
  password: "",
  confirmPassword: "",
};

export function InviteRegistrationForm({
  organizationId,
  organizationName,
  kind,
}: {
  organizationId: string;
  organizationName: string;
  kind: InviteKind;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [document, setDocument] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required");
      return;
    }
    if (!form.email.trim()) {
      setError("Email address is required");
      return;
    }
    if (!/^\d{11}$/.test(form.nin)) {
      setError("Enter your 11-digit NIN");
      return;
    }
    if (!document) {
      setError("Upload your NIN document");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (
      !/[A-Z]/.test(form.password) ||
      !/[a-z]/.test(form.password) ||
      !/[0-9]/.test(form.password)
    ) {
      setError(
        "Password must include uppercase, lowercase and a number"
      );
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("organizationId", organizationId);
      formData.set("firstName", form.firstName.trim());
      formData.set("lastName", form.lastName.trim());
      formData.set("otherNames", form.otherNames.trim());
      formData.set("email", form.email.trim());
      formData.set("phone", form.phone.trim());
      formData.set("dateOfBirth", form.dateOfBirth);
      formData.set("gender", form.gender);
      formData.set("address", form.address.trim());
      formData.set("state", form.state.trim());
      formData.set("lga", form.lga.trim());
      formData.set("nin", form.nin);
      formData.set("password", form.password);
      formData.set("ninDocument", document);

      const result = await registerViaInvite(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setDone(true);
      toast.success("Account created. Signing you in…");

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (signInError) {
        router.push("/auth/login");
        return;
      }

      router.push(kind === "member" ? "/member" : "/employee");
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-green-600" />
        <p className="font-medium">Your account is ready</p>
        <p className="text-sm text-muted-foreground">
          Welcome to {organizationName}. Taking you to your dashboard…
        </p>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form
      method="post"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(event) => set("firstName", event.target.value)}
            autoComplete="given-name"
            placeholder="Ada"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(event) => set("lastName", event.target.value)}
            autoComplete="family-name"
            placeholder="Okafor"
          />
        </div>

        {kind === "employee" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="otherNames">Other Names</Label>
            <Input
              id="otherNames"
              value={form.otherNames}
              onChange={(event) => set("otherNames", event.target.value)}
              placeholder="Optional"
            />
          </div>
        ) : null}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
            autoComplete="tel"
            placeholder="0801 234 5678"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => set("dateOfBirth", event.target.value)}
          />
        </div>

        {kind === "employee" ? (
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select
              value={form.gender || undefined}
              onValueChange={(value) => set("gender", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(event) => set("address", event.target.value)}
            placeholder="Street, city, state"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Select
            value={form.state || undefined}
            onValueChange={(value) => {
              set("state", value ?? "");
              set("lga", "");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {NIGERIA_STATES.map((state) => (
                <SelectItem key={state.name} value={state.name}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lga">Local Government Area</Label>
          <Select
            value={form.lga || undefined}
            onValueChange={(value) => set("lga", value ?? "")}
            disabled={!form.state || getLgasForState(form.state).length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  form.state ? "Select LGA" : "Select state first"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {getLgasForState(form.state).map((lga) => (
                <SelectItem key={lga} value={lga}>
                  {lga}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nin">NIN *</Label>
          <Input
            id="nin"
            value={form.nin}
            onChange={(event) =>
              set("nin", event.target.value.replace(/\D/g, "").slice(0, 11))
            }
            inputMode="numeric"
            maxLength={11}
            placeholder="11-digit NIN"
          />
        </div>
        <div className="space-y-2">
          <Label>NIN Document *</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => {
              setDocument(event.target.files?.[0] ?? null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {document ? "Replace document" : "Upload NIN document"}
          </Button>
          {document ? (
            <p className="truncate text-xs text-green-600">{document.name}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Slip, card image or PDF (max 5MB)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={(event) => set("password", event.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <PasswordInput
            id="confirmPassword"
            value={form.confirmPassword}
            onChange={(event) => set("confirmPassword", event.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Creating your account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}
