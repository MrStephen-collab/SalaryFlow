"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveLoanApplication,
  rejectLoanApplication,
  disburseLoan,
} from "@/app/dashboard/loans/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Send } from "lucide-react";

export function ApplicationActions({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);

  const canApprove = status === "SUBMITTED" || status === "UNDER_REVIEW";
  const canDisburse = status === "APPROVED" || status === "READY_FOR_DISBURSEMENT";

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveLoanApplication(
        applicationId,
        approveNotes || undefined
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setApproveOpen(false);
        setApproveNotes("");
        router.refresh();
      }
    });
  };

  const handleReject = () => {
    if (!rejectReason) {
      toast.error("Rejection reason is required");
      return;
    }
    startTransition(async () => {
      const result = await rejectLoanApplication(applicationId, rejectReason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setRejectOpen(false);
        setRejectReason("");
        router.refresh();
      }
    });
  };

  const handleDisburse = () => {
    startTransition(async () => {
      const result = await disburseLoan(applicationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.refresh();
      }
    });
  };

  if (!canApprove && !canDisburse) return null;

  return (
    <div className="flex items-center gap-2">
      {canApprove && (
        <>
          <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
            <DialogTrigger
              render={
                <Button>
                  <CheckCircle className="size-4" />
                  Approve
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Approve Loan Application</DialogTitle>
                <DialogDescription>
                  This will approve the loan for disbursement.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    placeholder="Add any notes about this approval..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setApproveOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApprove} disabled={isPending}>
                  {isPending ? "Approving..." : "Confirm Approval"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger
              render={
                <Button variant="destructive">
                  <XCircle className="size-4" />
                  Reject
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reject Loan Application</DialogTitle>
                <DialogDescription>
                  Please provide a reason for rejection.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Rejection Reason *</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter the reason for rejecting this application..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isPending || !rejectReason}
                >
                  {isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canDisburse && (
        <Button onClick={handleDisburse} disabled={isPending}>
          <Send className="size-4" />
          {isPending ? "Disbursing..." : "Disburse Loan"}
        </Button>
      )}
    </div>
  );
}
