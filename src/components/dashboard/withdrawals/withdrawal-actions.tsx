"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import {
  submitWithdrawalForReview,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  confirmWithdrawalPaid,
  failWithdrawal,
} from "@/app/dashboard/withdrawals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Banknote,
  AlertTriangle,
} from "lucide-react";

export function WithdrawalActions({
  status,
  reference,
}: {
  status: string;
  reference: string;
}) {
  const router = useRouter();
  const { withdrawalId } = useParams<{ withdrawalId: string }>();
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [externalReference, setExternalReference] = useState("");

  const run = (action: () => Promise<{ success?: string; error?: string; note?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Done");
        if (result.note) toast.info(result.note);
        setRejecting(false);
        setConfirmPaidOpen(false);
        setReason("");
        setExternalReference("");
        router.refresh();
      }
    });
  };

  if (status === "PAID" || status === "FAILED" || status === "REJECTED") {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant={status === "PAID" ? "default" : "destructive"}
          className="gap-1"
        >
          {status === "PAID" ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <AlertTriangle className="size-3" />
          )}
          {status}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            run(() => submitWithdrawalForReview(withdrawalId))
          }
        >
          <Eye className="size-4" />
          Move to Review
        </Button>
      )}

      {(status === "PENDING" || status === "REVIEW") && (
        <>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(() => approveWithdrawal(withdrawalId))}
          >
            <CheckCircle2 className="size-4" />
            Approve
          </Button>
          {rejecting ? (
            <div className="flex items-center gap-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rejection reason"
                className="w-56"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending || !reason}
                onClick={() => run(() => rejectWithdrawal(withdrawalId, reason))}
              >
                Confirm Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRejecting(false);
                  setReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejecting(true)}
            >
              <XCircle className="size-4" />
              Reject
            </Button>
          )}
        </>
      )}

      {status === "APPROVED" && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => run(() => processWithdrawal(withdrawalId))}
        >
          <Banknote className="size-4" />
          Process Payout
        </Button>
      )}

      {status === "PROCESSING" && (
        <>
          <Button size="sm" onClick={() => setConfirmPaidOpen(true)}>
            <CheckCircle2 className="size-4" />
            Confirm Paid
          </Button>

          {reason !== "" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending || !reason}
              onClick={() => run(() => failWithdrawal(withdrawalId, reason))}
            >
              <AlertTriangle className="size-4" />
              Mark Failed
            </Button>
          )}
        </>
      )}

      {isPending && <Loader2 className="size-4 animate-spin" />}

      <Dialog open={confirmPaidOpen} onOpenChange={setConfirmPaidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm withdrawal paid</DialogTitle>
            <DialogDescription>
              Only confirm after the money has left your bank or Paystack
              account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="settlementReference">
              External settlement reference (optional)
            </Label>
            <Input
              id="settlementReference"
              value={externalReference}
              onChange={(event) => setExternalReference(event.target.value)}
              placeholder="Bank transfer or Paystack reference"
            />
            <p className="text-xs text-muted-foreground">
              Paste the bank/Paystack transfer reference if you have one. Leave
              it blank to record the withdrawal reference ({reference}).
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmPaidOpen(false);
                setExternalReference("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                run(() =>
                  confirmWithdrawalPaid(withdrawalId, externalReference.trim())
                )
              }
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {isPending ? "Confirming…" : "Confirm Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}