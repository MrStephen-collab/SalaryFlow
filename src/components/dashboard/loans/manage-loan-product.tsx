"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteLoanProduct } from "@/app/dashboard/loans/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { EditProductDialog } from "@/components/dashboard/loans/edit-product-dialog";

export type LoanProduct = {
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
  maximum_salary_deduction_percentage: number;
  minimum_salary: number;
  minimum_employment_period_months: number;
  guarantor_required: boolean;
  collateral_required: boolean;
  active: boolean;
};

export function ManageLoanProduct({ product }: { product: LoanProduct }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteLoanProduct(product.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setDeleteOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8"
              aria-label="Product actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <EditProductDialogAsItem product={product} />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Loan Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{product.name}&quot;? This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
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
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditProductDialogAsItem({ product }: { product: LoanProduct }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        Edit
      </DropdownMenuItem>
      <EditProductDialog open={open} onOpenChange={setOpen} product={product} />
    </>
  );
}