"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setMaintenanceMode } from "@/app/super-admin/integrations/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wrench } from "lucide-react";

export function MaintenanceModeCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      const result = await setMaintenanceMode(next);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update maintenance mode");
        return;
      }
      setOn(next);
      toast.success(
        next
          ? "Maintenance mode is ON. Only the platform owner can access the app."
          : "Maintenance mode is OFF. The platform is live."
      );
      router.refresh();
    });
  }

  return (
    <Card className={on ? "border-amber-400" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4 text-amber-600" />
              Maintenance mode
            </CardTitle>
            <CardDescription>
              When enabled, everyone except the platform owner sees a
              maintenance page. Payment webhooks and APIs stay available.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={on ? "destructive" : "outline"}>
              {on ? "Maintenance ON" : "Live"}
            </Badge>
            {isPending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={on}
                onCheckedChange={toggle}
                disabled={isPending}
                aria-label="Toggle maintenance mode"
              />
            )}
          </div>
        </div>
      </CardHeader>
      {on ? (
        <CardContent>
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            The public site is currently in maintenance. Switch this off to
            restore access for organizations, employees and members.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
