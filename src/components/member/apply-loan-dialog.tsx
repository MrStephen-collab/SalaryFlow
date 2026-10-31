"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyMemberLoan } from "@/app/member/actions";
import { uploadNinDocument } from "@/app/nin/actions";
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
import { CheckCircle2, HandCoins, Loader2, Upload } from "lucide-react";

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ApplyLoanDialog({
  maxLoan,
  eligible,
  monthsRemaining,
  hasActiveLoan,
  collateralRequired = false,
  interestRate = 1,
  processingFee = 0,
  insuranceFee = 0,
  durationMonths = 6,
}: {
  maxLoan: number;
  eligible: boolean;
  monthsRemaining: number;
  hasActiveLoan: boolean;
  collateralRequired?: boolean;
  interestRate?: number;
  processingFee?: number;
  insuranceFee?: number;
  durationMonths?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralDocumentUrl, setCollateralDocumentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const numericAmount = Number(amount.replace(/,/g, ""));
  const blocked = !eligible || hasActiveLoan || maxLoan <= 0;

  async function handleCollateralFile(file: File) {
    setUploading(true);
    const result = await uploadNinDocument(file);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setCollateralDocumentUrl(result.url ?? "");
    toast.success("Collateral document uploaded");
  }

  function handleSubmit() {
    if (!Number.isFinite(numericAmount) || numericAmount < 1000) {
      toast.error("Enter at least ₦1,000");
      return;
    }
    if (numericAmount > maxLoan) {
      toast.error(`Your maximum loan is ${naira(maxLoan)}`);
      return;
    }
    if (collateralRequired) {
      if (!collateralDescription.trim()) {
        toast.error("Enter the collateral description");
        return;
      }
      if (!collateralDocumentUrl) {
        toast.error("Upload the collateral document");
        return;
      }
    }

    startTransition(async () => {
      const result = await applyMemberLoan(numericAmount, purpose, {
        description: collateralDescription,
        documentUrl: collateralDocumentUrl,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not submit your application");
        return;
      }
      toast.success(result.success ?? "Loan application submitted");
      setOpen(false);
      setAmount("");
      setPurpose("");
      setCollateralDescription("");
      setCollateralDocumentUrl("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={blocked}>
            <HandCoins className="size-4" />
            Apply for Loan
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for a Loan</DialogTitle>
          <DialogDescription>
            Your limit is based on your own savings. You can borrow up to{" "}
            {naira(maxLoan)}.
          </DialogDescription>
        </DialogHeader>

        {monthsRemaining > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            You can apply after {monthsRemaining} more month(s) of active
            membership.
          </div>
        ) : hasActiveLoan ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            You already have a loan in progress. Repay it before applying again.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1000}
                max={maxLoan}
                step={500}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={`Up to ${naira(maxLoan)}`}
              />
            </div>
            <div className="space-y-2">
              <Label>What is the loan for?</Label>
              <Input
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="e.g. School fees"
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              Interest: <span className="font-medium text-foreground">{interestRate}%</span>
              {processingFee > 0 ? (
                <> · Processing fee: <span className="font-medium text-foreground">{naira(processingFee)}</span></>
              ) : null}
              {insuranceFee > 0 ? (
                <> · Insurance: <span className="font-medium text-foreground">{naira(insuranceFee)}</span></>
              ) : null}
              {" "}· Duration: <span className="font-medium text-foreground">{durationMonths} months</span>
              {processingFee + insuranceFee > 0 ? (
                <span className="mt-1 block">
                  Fees are deducted from the amount credited to your wallet.
                </span>
              ) : null}
            </div>

            {collateralRequired ? (
              <>
                <div className="space-y-2">
                  <Label>Collateral description *</Label>
                  <Input
                    value={collateralDescription}
                    onChange={(event) => setCollateralDescription(event.target.value)}
                    placeholder="e.g. Shop inventory, titled land"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Collateral document *</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleCollateralFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {uploading
                      ? "Uploading…"
                      : collateralDocumentUrl
                        ? "Replace document"
                        : "Upload collateral document"}
                  </Button>
                  {collateralDocumentUrl ? (
                    <p className="inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="size-3.5" /> Document uploaded
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Your request is reviewed by the organization. Once approved, the
              loan is credited to your savings wallet.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || blocked || numericAmount < 1000}
          >
            {isPending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
