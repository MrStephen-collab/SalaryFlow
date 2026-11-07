"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveIntegrations } from "@/app/super-admin/integrations/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  Save,
} from "lucide-react";
import {
  MODE_KEYS,
  PAIR_BASES,
  PROVIDER_OPTIONS,
  SINGLE_KEYS,
} from "@/lib/integration-fields";
import type { IntegrationRow } from "@/services/platform-integration-service";

const CATEGORY_META: Record<
  string,
  { title: string; description: string; icon: typeof CreditCard }
> = {
  payment: {
    title: "Payments",
    description:
      "Platform payment defaults for lending-fund top-ups, member savings deposits, payouts and organization subscriptions. Fill the Test and Live columns separately.",
    icon: CreditCard,
  },
  email: {
    title: "Email",
    description:
      "Platform transactional email defaults. Organizations can override these on their own APIs page.",
    icon: Mail,
  },
  sms: {
    title: "SMS",
    description:
      "Platform SMS defaults. Organizations can override these on their own APIs page.",
    icon: MessageSquare,
  },
};

export function IntegrationsForm({ rows }: { rows: IntegrationRow[] }) {
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

  function save() {
    startTransition(async () => {
      const result = await saveIntegrations(values);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save integrations");
        return;
      }
      toast.success("Platform integrations saved");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="font-medium">Platform defaults</p>
        <p className="text-xs text-muted-foreground">
          These values apply to every organization that has not saved its own
          credentials. Organization-specific values always take precedence.
          {configuredCount > 0
            ? ` ${configuredCount} platform value${
                configuredCount === 1 ? "" : "s"
              } configured.`
            : " No platform values configured yet."}
        </p>
      </div>

      {categories.map((category) => {
        const meta = CATEGORY_META[category] ?? {
          title: category,
          description: "",
          icon: CreditCard,
        };
        const Icon = meta.icon;
        const categoryRows = rows.filter((row) => row.category === category);
        const singleRows = categoryRows.filter((row) =>
          SINGLE_KEYS.has(row.key)
        );
        const pairs = PAIR_BASES.map((base) => ({
          base,
          test: categoryRows.find((row) => row.key === `${base}_test`),
          live: categoryRows.find((row) => row.key === `${base}_live`),
        })).filter((pair) => pair.test && pair.live);

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-muted-foreground" />
                {meta.title}
              </CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {singleRows.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {singleRows.map((row) => (
                    <div key={row.key} className="space-y-2">
                      <Label htmlFor={`platform-${row.key}`}>{row.label}</Label>
                      {MODE_KEYS.has(row.key) ? (
                        <Select
                          value={values[row.key] || "test"}
                          onValueChange={(value) =>
                            set(row.key, value ?? "test")
                          }
                        >
                          <SelectTrigger
                            id={`platform-${row.key}`}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">Test</SelectItem>
                            <SelectItem value="live">Live</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : PROVIDER_OPTIONS[row.key] ? (
                        <Select
                          value={values[row.key] || "__default__"}
                          onValueChange={(value) =>
                            set(
                              row.key,
                              !value || value === "__default__" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger
                            id={`platform-${row.key}`}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">
                              Use environment default
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
                          id={`platform-${row.key}`}
                          value={values[row.key] ?? ""}
                          onChange={(event) => set(row.key, event.target.value)}
                          placeholder="Optional platform default"
                          autoComplete="off"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {pairs.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Credential</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead>Live</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pairs.map(({ base, test, live }) => (
                        <TableRow key={base}>
                          <TableCell className="text-sm font-medium whitespace-nowrap">
                            {test?.label ?? base}
                          </TableCell>
                          {[test, live].map((row) =>
                            row ? (
                              <TableCell key={row.key}>
                                <Input
                                  id={`platform-${row.key}`}
                                  type={row.is_secret ? "password" : "text"}
                                  value={values[row.key] ?? ""}
                                  onChange={(event) =>
                                    set(row.key, event.target.value)
                                  }
                                  placeholder={
                                    row.key.endsWith("_test")
                                      ? "Test credential"
                                      : "Live credential"
                                  }
                                  autoComplete="off"
                                />
                              </TableCell>
                            ) : (
                              <TableCell key={`${base}-empty`} />
                            )
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
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
          {isPending ? "Saving…" : "Save platform integrations"}
        </Button>
      </div>
    </div>
  );
}
