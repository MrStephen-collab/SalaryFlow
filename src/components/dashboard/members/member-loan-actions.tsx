"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveMemberLoan,
  disburseMemberLoan,
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
import { Banknote, Check, X } from "lucide-react";

const PENDING_STATUSES = ["PENDING", "SUBMITTED", "UNDER_REVIEW"];

export function MemberLoanActions({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canApprove = PENDING_STATUSES.includes(status);
  const canDisburse = status === "APPROVED";

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

  function disburse() {
    startTransition(async () => {
      const result = await disburseMemberLoan(applicationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Loan disbursed");
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

  if (!canApprove && !canDisburse) return null;

  return (
    <div className="flex justify-end gap-2">
      {canApprove ? (
        <>
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
        </>
      ) : (
        <Button size="sm" onClick={disburse} disabled={isPending}>
          <Banknote className="size-4" />
          {isPending ? "Disbursing…" : "Disburse Loan"}
        </Button>
      )}

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
