"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/app/dashboard/announcements/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import type { Announcement } from "@/services/announcement-service";

export function AnnouncementManager({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"ALL" | "EMPLOYEE" | "MEMBER">("ALL");
  const [isPending, startTransition] = useTransition();

  function create() {
    if (!message.trim()) {
      toast.error("Enter an announcement message");
      return;
    }
    startTransition(async () => {
      const result = await createAnnouncement(message, audience);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save the announcement");
        return;
      }
      toast.success("Announcement published");
      setMessage("");
      router.refresh();
    });
  }

  function toggle(announcement: Announcement, active: boolean) {
    startTransition(async () => {
      const result = await updateAnnouncement(announcement.id, { active });
      if (!result.ok) {
        toast.error(result.error ?? "Could not update the announcement");
        return;
      }
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAnnouncement(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete the announcement");
        return;
      }
      toast.success("Announcement removed");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3 rounded-lg border p-4">
        <Label>New announcement</Label>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          placeholder="e.g. Pay your loans on time to keep enjoying thrift-backed loans."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 sm:w-56">
            <Label>Show to</Label>
            <Select
              value={audience}
              onValueChange={(value) =>
                setAudience(
                  (value ?? "ALL") as "ALL" | "EMPLOYEE" | "MEMBER"
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) =>
                    value === "MEMBER"
                      ? "Members"
                      : value === "EMPLOYEE"
                        ? "Employees"
                        : "Everyone"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Everyone</SelectItem>
                <SelectItem value="EMPLOYEE">Employees</SelectItem>
                <SelectItem value="MEMBER">Members</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-2 size-6" />
          No announcements yet. Members and employees will see active messages
          scrolling in their portal header.
        </div>
      ) : (
        <ul className="space-y-2">
          {announcements.map((announcement) => (
            <li
              key={announcement.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm">{announcement.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(announcement.created_at).toLocaleString("en-NG")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">
                  {announcement.audience === "MEMBER"
                    ? "Members"
                    : announcement.audience === "EMPLOYEE"
                      ? "Employees"
                      : "Everyone"}
                </Badge>
                <Badge variant={announcement.active ? "default" : "secondary"}>
                  {announcement.active ? "Active" : "Off"}
                </Badge>
                <Switch
                  checked={announcement.active}
                  onCheckedChange={(value) => toggle(announcement, value)}
                  aria-label="Toggle announcement"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(announcement.id)}
                  aria-label="Delete announcement"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
