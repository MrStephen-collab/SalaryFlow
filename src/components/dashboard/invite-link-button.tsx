"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setRegistrationLinkEnabled } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Check, Copy, Link2 } from "lucide-react";

/**
 * Shareable self-registration link for an organization. Employees and external
 * members can create their own accounts (including NIN) with this URL.
 */
export function InviteLinkButton({
  organizationId,
  kind,
  enabled = true,
}: {
  organizationId: string;
  kind: "employee" | "member";
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActive(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const path = `/join/${organizationId}?role=${kind}`;
    setUrl(`${window.location.origin}${path}`);
    setCopied(false);
  }, [open, organizationId, kind]);

  async function toggle(next: boolean) {
    setSaving(true);
    setActive(next);
    const result = await setRegistrationLinkEnabled(kind, next);
    setSaving(false);
    if (result.error) {
      setActive(!next);
      toast.error(result.error);
      return;
    }
    toast.success(next ? "Registration link is live" : "Registration link is off");
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Registration link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  const label = kind === "member" ? "Member registration link" : "Employee registration link";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Link2 className="size-4" />
            {kind === "member" ? "Member Link" : "Employee Link"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Share this link with {kind === "member" ? "members" : "employees"} so
            they can create their own account for this organization. They will
            enter their details, NIN and NIN document, then set a password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="invite-link">Registration link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="invite-link"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              disabled={!active}
            />
            <Button type="button" onClick={copyLink} disabled={!active}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {active ? "Link is active" : "Link is switched off"}
              </p>
              <p className="text-xs text-muted-foreground">
                {active
                  ? "Anyone with this link can register."
                  : "The registration page is closed for new sign-ups."}
              </p>
            </div>
            <Switch
              checked={active}
              disabled={saving}
              onCheckedChange={toggle}
              aria-label="Toggle registration link"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Self-registered accounts require NIN and document verification.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
