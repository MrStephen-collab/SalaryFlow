"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CreateLoanProductValues } from "@/schemas/loan";
import {
  createLoanProduct,
  deleteLoanProduct,
  updateLoanProduct,
} from "@/app/dashboard/loans/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  INTEREST_METHODS,
  REPETITION_FREQUENCIES,
} from "@/schemas/loan";
import { ManageLoanProduct, type LoanProduct } from "@/components/dashboard/loans/manage-loan-product";
import {
  MEMBER_LOAN_PRODUCT_NAME,
  isMemberLoanProduct,
  isMemberLoanProductName,
} from "@/lib/loan-products";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; product: LoanProduct }
  | { mode: "delete"; product: LoanProduct };

type ProductFormState = {
  name: string;
  description: string;
  minimumAmount: number;
  maximumAmount: number;
  interestRate: number;
  interestMethod: (typeof INTEREST_METHODS)[number];
  durationMonths: number;
  repaymentFrequency: (typeof REPETITION_FREQUENCIES)[number];
  processingFee: number;
  insuranceFee: number;
  minimumEmploymentPeriodMonths: number;
  guarantorRequired: boolean;
  collateralRequired: boolean;
};

const emptyProductForm: ProductFormState = {
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
  minimumEmploymentPeriodMonths: 0,
  guarantorRequired: false,
  collateralRequired: false,
};

function productToForm(product: LoanProduct): ProductFormState {
  return {
    name: product.name,
    description: product.description ?? "",
    minimumAmount: product.minimum_amount,
    maximumAmount: product.maximum_amount,
    interestRate: product.interest_rate,
    interestMethod: product.interest_method as (typeof INTEREST_METHODS)[number],
    durationMonths: product.duration_months,
    repaymentFrequency:
      product.repayment_frequency as (typeof REPETITION_FREQUENCIES)[number],
    processingFee: product.processing_fee,
    insuranceFee: product.insurance_fee,
    minimumEmploymentPeriodMonths: product.minimum_employment_period_months,
    guarantorRequired: product.guarantor_required,
    collateralRequired: product.collateral_required,
  };
}

export function LoanProductsManager({
  products,
  scope = "EMPLOYEE",
}: {
  products: LoanProduct[];
  scope?: "EMPLOYEE" | "MEMBER";
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [isPending, startTransition] = useTransition();

  const memberScope = scope === "MEMBER";
  const visibleProducts = products.filter((product) =>
    memberScope ? isMemberLoanProduct(product) : !isMemberLoanProduct(product)
  );

  const set =
    <K extends keyof ProductFormState>(
      key: K,
      value: ProductFormState[K],
    ) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setForm(
      memberScope
        ? {
            ...emptyProductForm,
            name: MEMBER_LOAN_PRODUCT_NAME,
            minimumEmploymentPeriodMonths: 0,
          }
        : emptyProductForm
    );
    setDialog({ mode: "create" });
  };

  const openEdit = (product: LoanProduct) => {
    setForm(productToForm(product));
    setDialog({ mode: "edit", product });
  };

  const openDelete = (product: LoanProduct) => {
    setDialog({ mode: "delete", product });
  };

  const closeDialog = () => {
    if (!isPending) setDialog(null);
  };

  const handleSubmit = () => {
    if (!dialog || dialog.mode === "delete") return;

    if (!memberScope && isMemberLoanProductName(form.name)) {
      toast.error(
        `"${MEMBER_LOAN_PRODUCT_NAME}" is reserved for the member loan product.`
      );
      return;
    }

    const mode = dialog.mode;
    const values: CreateLoanProductValues = {
      name: memberScope ? MEMBER_LOAN_PRODUCT_NAME : form.name.trim(),
      description: form.description || undefined,
      minimumAmount: form.minimumAmount,
      maximumAmount: form.maximumAmount,
      interestRate: form.interestRate,
      interestMethod: form.interestMethod,
      durationMonths: form.durationMonths,
      repaymentFrequency: form.repaymentFrequency,
      processingFee: form.processingFee,
      insuranceFee: form.insuranceFee,
      minimumEmploymentPeriodMonths: memberScope
        ? 0
        : form.minimumEmploymentPeriodMonths,
      guarantorRequired: form.guarantorRequired,
      collateralRequired: form.collateralRequired,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createLoanProduct(values)
          : await updateLoanProduct(dialog.product.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setDialog(null);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (dialog?.mode !== "delete") return;

    startTransition(async () => {
      const result = await deleteLoanProduct(dialog.product.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setDialog(null);
      router.refresh();
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);

  const productLabel = memberScope ? "Member Loan Product" : "Employee Loan Product";

  const dialogTitle =
    dialog?.mode === "edit"
      ? `Edit ${productLabel}`
      : dialog?.mode === "delete"
        ? `Delete ${productLabel}`
        : `Create ${productLabel}`;

  const dialogDescription =
    dialog?.mode === "edit"
      ? memberScope
        ? "Update the terms used for member savings-backed loans."
        : `Update ${dialog.product.name} settings.`
      : dialog?.mode === "delete"
        ? `Are you sure you want to delete "${dialog.product.name}"? This can't be undone.`
        : memberScope
          ? "Set the terms members see when they apply for a savings-backed loan."
          : "Define a new loan product for your employees.";

  const isMemberProduct = memberScope;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {memberScope ? "Member Loan Product" : "Employee Loan Products"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {memberScope
              ? "Terms used when members apply for a savings-backed loan"
              : "Manage loan products available to employees"}
          </p>
        </div>
        {!memberScope || visibleProducts.length === 0 ? (
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="size-4" />
            {memberScope ? "Create Member Product" : "New Product"}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={memberScope ? "outline" : "default"}
          size="sm"
          render={<Link href="/dashboard/employees/loan-products" />}
        >
          Employee Products
        </Button>
        <Button
          variant={memberScope ? "default" : "outline"}
          size="sm"
          render={<Link href="/dashboard/members/loan-products" />}
        >
          Member Product
        </Button>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/dashboard/loans" />}
        >
          All Product Catalogues
        </Button>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="rounded-md border">
          <div className="py-12 text-center">
            <p className="text-sm font-medium">
              {memberScope
                ? "No member loan product yet"
                : "No employee loan products yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {memberScope
                ? "Create the member savings loan product to set its terms."
                : "Create your first loan product to start offering employee loans."}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Amount Range</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={7} itemLabel="products">
              {visibleProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCurrency(product.minimum_amount)} –{" "}
                    {formatCurrency(product.maximum_amount)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{product.interest_rate}%</span>
                      <span className="ml-1 text-muted-foreground">
                        ({product.interest_method === "FLAT"
                          ? "Flat"
                          : product.interest_method === "REDUCING_BALANCE"
                            ? "Reducing"
                            : "Amortized"})
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{product.duration_months} mo</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {product.guarantor_required && (
                        <Badge variant="secondary" className="text-xs">
                          Guarantor
                        </Badge>
                      )}
                      {product.collateral_required && (
                        <Badge variant="secondary" className="text-xs">
                          Collateral
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ManageLoanProduct
                      product={product as LoanProduct}
                      onEdit={openEdit}
                      onDelete={openDelete}
                      canDelete={!memberScope}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </CollapsibleTableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {dialog?.mode === "delete" ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete Loan Product</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{dialog.product.name}
                  &quot;? This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>{dialogDescription}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Employee Welfare Loan"
                    disabled={memberScope}
                  />
                  {memberScope ? (
                    <p className="text-xs text-muted-foreground">
                      This name is reserved so the member portal can find the
                      product automatically.
                    </p>
                  ) : null}
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
                    onChange={(e) => set("durationMonths", Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Repayment Frequency *</Label>
                  <Select
                    value={form.repaymentFrequency}
                    onValueChange={(v) =>
                      set(
                        "repaymentFrequency",
                        v as (typeof REPETITION_FREQUENCIES)[number],
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
                    onChange={(e) => set("processingFee", Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Insurance Fee (₦)</Label>
                  <Input
                    type="number"
                    value={form.insuranceFee}
                    onChange={(e) => set("insuranceFee", Number(e.target.value))}
                  />
                </div>

                {!isMemberProduct ? (
                  <div className="space-y-2">
                    <Label>Min Employment (Months)</Label>
                    <Input
                      type="number"
                      value={form.minimumEmploymentPeriodMonths}
                      onChange={(e) =>
                        set("minimumEmploymentPeriodMonths", Number(e.target.value))
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

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isPending || !form.name}>
                  {isPending
                    ? dialog?.mode === "create"
                      ? "Creating..."
                      : "Saving..."
                    : dialog?.mode === "create"
                      ? "Create Product"
                      : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
