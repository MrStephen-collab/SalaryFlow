"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CreateLoanProductValues } from "@/schemas/loan";
import { updateLoanProduct } from "@/app/dashboard/loans/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Pencil } from "lucide-react";
import { INTEREST_METHODS, REPETITION_FREQUENCIES } from "@/schemas/loan";

interface Product {
  id: string;
  name: string;
  description: string | null;
  minimum_amount: number;
  maximum_amount: number;
  interest_rate: number;
  interest_method: string;
  duration_months: number;
  repayment_frequency: string;
  processing_fee: number;
  insurance_fee: number;
  minimum_employment_period_months: number;
  guarantor_required: boolean;
  collateral_required: boolean;
}

export function EditProductDialog({
  product,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  product: Product;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    controlledOnOpenChange?.(next);
  };
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    minimumAmount: product.minimum_amount,
    maximumAmount: product.maximum_amount,
    interestRate: product.interest_rate,
    interestMethod: product.interest_method as (typeof INTEREST_METHODS)[number],
    durationMonths: product.duration_months,
    repaymentFrequency: product.repayment_frequency as (typeof REPETITION_FREQUENCIES)[number],
    processingFee: product.processing_fee,
    insuranceFee: product.insurance_fee,
    minimumEmploymentPeriodMonths: product.minimum_employment_period_months,
    guarantorRequired: product.guarantor_required,
    collateralRequired: product.collateral_required,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = () => {
    startTransition(async () => {
      const values: Partial<CreateLoanProductValues> = {
        name: form.name,
        description: form.description || undefined,
        minimumAmount: form.minimumAmount,
        maximumAmount: form.maximumAmount,
        interestRate: form.interestRate,
        interestMethod: form.interestMethod,
        durationMonths: form.durationMonths,
        repaymentFrequency: form.repaymentFrequency,
        processingFee: form.processingFee,
        insuranceFee: form.insuranceFee,
        minimumEmploymentPeriodMonths: form.minimumEmploymentPeriodMonths,
        guarantorRequired: form.guarantorRequired,
        collateralRequired: form.collateralRequired,
      };
      const result = await updateLoanProduct(product.id, values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setOpen(false);
        router.refresh();
      }
    });
  };

  const isMemberProduct = form.name.trim().toLowerCase() === "member savings loan";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Loan Product</DialogTitle>
          <DialogDescription>Update {product.name} settings.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Product Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Minimum Amount (₦)</Label>
            <Input
              type="number"
              value={form.minimumAmount}
              onChange={(e) => set("minimumAmount", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Maximum Amount (₦)</Label>
            <Input
              type="number"
              value={form.maximumAmount}
              onChange={(e) => set("maximumAmount", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Rate (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.interestRate}
              onChange={(e) => set("interestRate", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Method</Label>
            <Select
              value={form.interestMethod}
              onValueChange={(v) =>
                set("interestMethod", v as (typeof INTEREST_METHODS)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FLAT">Flat</SelectItem>
                <SelectItem value="REDUCING_BALANCE">
                  Reducing Balance
                </SelectItem>
                <SelectItem value="AMORTIZED">Amortized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duration (Months)</Label>
            <Input
              type="number"
              value={form.durationMonths}
              onChange={(e) =>
                set("durationMonths", Number(e.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Repayment Frequency</Label>
            <Select
              value={form.repaymentFrequency}
              onValueChange={(v) =>
                set(
                  "repaymentFrequency",
                  v as (typeof REPETITION_FREQUENCIES)[number]
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Processing Fee (₦)</Label>
            <Input
              type="number"
              value={form.processingFee}
              onChange={(e) =>
                set("processingFee", Number(e.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Insurance Fee (₦)</Label>
            <Input
              type="number"
              value={form.insuranceFee}
              onChange={(e) =>
                set("insuranceFee", Number(e.target.value))
              }
            />
          </div>

          {!isMemberProduct ? (
            <div className="space-y-2">
              <Label>Min Employment (Months)</Label>
              <Input
                type="number"
                value={form.minimumEmploymentPeriodMonths}
                onChange={(e) =>
                  set(
                    "minimumEmploymentPeriodMonths",
                    Number(e.target.value)
                  )
                }
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Guarantor Required</Label>
            <Switch
              checked={form.guarantorRequired}
              onCheckedChange={(v) => set("guarantorRequired", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Collateral Required</Label>
            <Switch
              checked={form.collateralRequired}
              onCheckedChange={(v) => set("collateralRequired", v)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !form.name}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
