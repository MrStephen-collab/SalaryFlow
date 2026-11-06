"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveIntegrations } from "@/app/super-admin/integrations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import type { IntegrationRow } from "@/services/platform-integration-service";

const CATEGORY_TITLES: Record<string, { title: string; description: string }> = {
  payment: {
    title: "Payments (Paystack / Flutterwave)",
    description:
      "Gateway keys used for lending-fund top-ups, member savings deposits and payouts. Saved values override the deployment environment variables.",
  },
  email: {
    title: "Email",
    description: "Provider and credentials used for transactional email.",
  },
  sms: {
    title: "SMS",
    description: "Provider and sender ID for SMS notifications (activate when ready).",
  },
};

export function IntegrationsForm({ rows }: { rows: IntegrationRow[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.key, row.value ?? ""]))
  );
  const [isPending, startTransition] = useTransition();

  const categories = Array.from(new Set(rows.map((row) => row.category)));

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveIntegrations(values);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save integrations");
        return;
      }
      toast.success("Integrations saved");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => {
        const meta = CATEGORY_TITLES[category] ?? {
          title: category,
          description: "",
        };
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base">{meta.title}</CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {rows
                .filter((row) => row.category === category)
                .map((row) => (
                  <div key={row.key} className="space-y-2">
                    <Label htmlFor={row.key}>{row.label}</Label>
                    <Input
                      id={row.key}
                      type={row.is_secret ? "password" : "text"}
                      value={values[row.key] ?? ""}
                      onChange={(event) => set(row.key, event.target.value)}
                      placeholder={
                        row.is_secret && row.value
                          ? "Saved — enter a new value to replace"
                          : row.is_secret
                            ? "Enter value"
                            : ""
                      }
                      autoComplete="off"
                    />
                  </div>
                ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={save} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isPending ? "Saving…" : "Save integrations"}
        </Button>
      </div>
    </div>
  );
}
