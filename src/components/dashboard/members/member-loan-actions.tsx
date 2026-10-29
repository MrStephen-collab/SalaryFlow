"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveMemberLoan,
  rejectMemberLoan,
} from "@/app/dashboard/members/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";

export function MemberLoanActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      const result = await approveMemberLoan(applicationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Loan approved");
      }
      router.refresh();
    });
  }

  function reject() {
    if (!reason.trim()) {
      toast.error("Enter a reason for rejecting this request");
      return;
    }
    startTransition(async () => {
      const result = await rejectMemberLoan(applicationId, reason.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Request rejected");
        setRejectOpen(false);
        setReason("");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" onClick={approve} disabled={isPending}>
        <Check className="size-4" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setRejectOpen(true)}
        disabled={isPending}
      >
        <X className="size-4" />
        Reject
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject loan request</DialogTitle>
            <DialogDescription>
              Give the member a clear reason. It is shown on their loan history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Savings history too short"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={isPending || !reason.trim()}
            >
              {isPending ? "Rejecting…" : "Reject request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
