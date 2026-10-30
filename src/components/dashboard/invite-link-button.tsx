"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Check, Copy, Link2 } from "lucide-react";

/**
 * Shareable self-registration link for an organization. Employees and external
 * members can create their own accounts (including NIN) with this URL.
 */
export function InviteLinkButton({
  organizationId,
  kind,
}: {
  organizationId: string;
  kind: "employee" | "member";
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const path = `/join/${organizationId}?role=${kind}`;
    setUrl(`${window.location.origin}${path}`);
    setCopied(false);
  }, [open, organizationId, kind]);

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
            />
            <Button type="button" onClick={copyLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can register under this organization. Only
            share it with the intended {kind}. Self-registered accounts require
            NIN verification before they are fully verified.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
