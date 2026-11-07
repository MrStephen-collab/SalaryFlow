"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveOrganizationIntegrations } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  Save,
} from "lucide-react";
import type { IntegrationRow } from "@/services/platform-integration-service";

const CATEGORY_META: Record<
  string,
  { title: string; description: string; icon: typeof CreditCard }
> = {
  payment: {
    title: "Payments",
    description:
      "Gateway credentials for funding, savings deposits and payouts for this organization.",
    icon: CreditCard,
  },
  email: {
    title: "Email",
    description: "Transactional email provider and sender identity.",
    icon: Mail,
  },
  sms: {
    title: "SMS",
    description: "SMS provider, sender ID and credentials.",
    icon: MessageSquare,
  },
};

const PROVIDER_OPTIONS: Record<string, string[]> = {
  payment_provider: ["paystack", "flutterwave", "manual"],
  email_provider: ["resend", "smtp"],
  sms_provider: ["termii", "twilio"],
};

export function OrganizationIntegrationsForm({
  organizationId,
  organizationName,
  rows,
}: {
  organizationId: string;
  organizationName: string;
  rows: IntegrationRow[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.key, row.value ?? ""]))
  );
  const [isPending, startTransition] = useTransition();

  const categories = Array.from(new Set(rows.map((row) => row.category)));
  const configuredCount = Object.values(values).filter(
    (value) => value.trim().length > 0
  ).length;

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save(nextValues = values) {
    startTransition(async () => {
      const result = await saveOrganizationIntegrations(
        organizationId,
        nextValues
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Organization integrations saved");
      router.refresh();
    });
  }

  function clearOverrides() {
    const cleared = Object.fromEntries(rows.map((row) => [row.key, ""]));
    setValues(cleared);
    save(cleared);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div>
          <p className="text-sm font-medium">{organizationName}</p>
          <p className="text-xs text-muted-foreground">
            {configuredCount} organization-specific value
            {configuredCount === 1 ? "" : "s"} configured
          </p>
        </div>
        <ConfirmDialog
          trigger={
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || configuredCount === 0}
            >
              <RotateCcw className="size-4" />
              Clear overrides
            </Button>
          }
          title="Clear organization overrides?"
          description="All organization-specific API values will be removed and this organization will fall back to the platform defaults."
          confirmLabel="Clear overrides"
          destructive
          onConfirm={clearOverrides}
        />
      </div>

      {categories.map((category) => {
        const meta = CATEGORY_META[category] ?? {
          title: category,
          description: "",
          icon: CreditCard,
        };
        const Icon = meta.icon;
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-muted-foreground" />
                {meta.title}
              </CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {rows
                .filter((row) => row.category === category)
                .map((row) => (
                  <div key={row.key} className="space-y-2">
                    <Label htmlFor={`org-${row.key}`}>{row.label}</Label>
                    {PROVIDER_OPTIONS[row.key] ? (
                      <Select
                        value={values[row.key] || "__default__"}
                        onValueChange={(value) =>
                          set(
                            row.key,
                            !value || value === "__default__" ? "" : value
                          )
                        }
                      >
                        <SelectTrigger id={`org-${row.key}`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">
                            Use platform default
                          </SelectItem>
                          {PROVIDER_OPTIONS[row.key].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`org-${row.key}`}
                        type={row.is_secret ? "password" : "text"}
                        value={values[row.key] ?? ""}
                        onChange={(event) => set(row.key, event.target.value)}
                        placeholder={
                          row.is_secret
                            ? "Use platform default or enter a value"
                            : "Use platform default"
                        }
                        autoComplete="off"
                      />
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={() => save()} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isPending ? "Saving…" : "Save organization APIs"}
        </Button>
      </div>
    </div>
  );
}
