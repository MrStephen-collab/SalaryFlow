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
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Banknote,
  AlertTriangle,
} from "lucide-react";

export function WithdrawalActions({ status }: { status: string }) {
  const router = useRouter();
  const { withdrawalId } = useParams<{ withdrawalId: string }>();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
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
        setConfirm(false);
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
          {confirm ? (
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
                  setConfirm(false);
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
              onClick={() => setConfirm(true)}
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
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs">External settlement reference</Label>
                <Input
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. bank transfer reference"
                  className="w-64"
                />
              </div>
              <Button
                size="sm"
                disabled={isPending || !externalReference.trim()}
                onClick={() =>
                  run(() => confirmWithdrawalPaid(withdrawalId, externalReference.trim()))
                }
              >
                <CheckCircle2 className="size-4" />
                Confirm Paid
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirm(false);
                  setExternalReference("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setConfirm(true)}>
              <CheckCircle2 className="size-4" />
              Confirm Paid
            </Button>
          )}

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
    </div>
  );
}