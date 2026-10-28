"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CreateLoanProductValues } from "@/schemas/loan";
import { createLoanProduct } from "@/app/dashboard/loans/actions";
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
import { Plus } from "lucide-react";
import {
  INTEREST_METHODS,
  REPETITION_FREQUENCIES,
} from "@/schemas/loan";

export function CreateProductDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    description: "",
    minimumAmount: 0,
    maximumAmount: 1000000,
    interestRate: 10,
    interestMethod: "FLAT" as (typeof INTEREST_METHODS)[number],
    durationMonths: 12,
    repaymentFrequency: "MONTHLY" as (typeof REPETITION_FREQUENCIES)[number],
    processingFee: 0,
    insuranceFee: 0,
    maximumSalaryDeductionPercentage: 30,
    minimumSalary: 0,
    minimumEmploymentPeriodMonths: 0,
    guarantorRequired: false,
    collateralRequired: false,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = () => {
    startTransition(async () => {
      const values: CreateLoanProductValues = {
        ...form,
        description: form.description || undefined,
      };
      const result = await createLoanProduct(values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setOpen(false);
        setForm({
          name: "",
          description: "",
          minimumAmount: 0,
          maximumAmount: 1000000,
          interestRate: 10,
          interestMethod: "FLAT",
          durationMonths: 12,
          repaymentFrequency: "MONTHLY",
          processingFee: 0,
          insuranceFee: 0,
          maximumSalaryDeductionPercentage: 30,
          minimumSalary: 0,
          minimumEmploymentPeriodMonths: 0,
          guarantorRequired: false,
          collateralRequired: false,
        });
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            New Product
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Loan Product</DialogTitle>
          <DialogDescription>
            Define a new loan product for your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Product Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Employee Welfare Loan"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief description of this loan product"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Minimum Amount (₦) *</Label>
            <Input
              type="number"
              value={form.minimumAmount}
              onChange={(e) => set("minimumAmount", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Maximum Amount (₦) *</Label>
            <Input
              type="number"
              value={form.maximumAmount}
              onChange={(e) => set("maximumAmount", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Rate (%) *</Label>
            <Input
              type="number"
              step="0.1"
              value={form.interestRate}
              onChange={(e) => set("interestRate", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Method *</Label>
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
            <Label>Duration (Months) *</Label>
            <Input
              type="number"
              value={form.durationMonths}
              onChange={(e) =>
                set("durationMonths", Number(e.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Repayment Frequency *</Label>
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

          <div className="space-y-2">
            <Label>Max Deduction % of Salary *</Label>
            <Input
              type="number"
              value={form.maximumSalaryDeductionPercentage}
              onChange={(e) =>
                set(
                  "maximumSalaryDeductionPercentage",
                  Number(e.target.value)
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Minimum Salary (₦)</Label>
            <Input
              type="number"
              value={form.minimumSalary}
              onChange={(e) =>
                set("minimumSalary", Number(e.target.value))
              }
            />
          </div>

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

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Guarantor Required</Label>
              <p className="text-xs text-muted-foreground">
                Employee must provide a guarantor
              </p>
            </div>
            <Switch
              checked={form.guarantorRequired}
              onCheckedChange={(v) => set("guarantorRequired", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Collateral Required</Label>
              <p className="text-xs text-muted-foreground">
                Employee must provide collateral
              </p>
            </div>
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
            {isPending ? "Creating..." : "Create Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
