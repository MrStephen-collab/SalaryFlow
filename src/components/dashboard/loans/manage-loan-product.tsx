"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

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
  minimum_employment_period_months: number;
  guarantor_required: boolean;
  collateral_required: boolean;
  active: boolean;
};

type ManageLoanProductProps = {
  product: LoanProduct;
  onEdit: (product: LoanProduct) => void;
  onDelete: (product: LoanProduct) => void;
  canDelete?: boolean;
};

export function ManageLoanProduct({
  product,
  onEdit,
  onDelete,
  canDelete = true,
}: ManageLoanProductProps) {
  return (
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
        <DropdownMenuItem onClick={() => onEdit(product)}>
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        {canDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(product)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
