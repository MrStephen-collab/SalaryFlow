"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordFundMovement } from "@/app/dashboard/ledger/actions";
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
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

type MovementType =
  | "FUNDING"
  | "DISBURSEMENT"
  | "REPAYMENT"
  | "WITHDRAWAL"
  | "ADJUSTMENT";

export function FundMovementDialog({
  fundAccountId,
  fundAccountName,
}: {
  fundAccountId: string;
  fundAccountName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<MovementType>("FUNDING");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");

  const isInflow = type === "FUNDING" || type === "REPAYMENT";
  const direction = isInflow ? "IN" : "OUT";

  const handleSubmit = () => {
    if (amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    startTransition(async () => {
      const result = await recordFundMovement(
        fundAccountId,
        type,
        amount,
        direction,
        description || `${type} movement`
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setOpen(false);
        setAmount(0);
        setDescription("");
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {isInflow ? (
              <ArrowDownToLine className="size-4" />
            ) : (
              <ArrowUpFromLine className="size-4" />
            )}
            Record Movement
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Fund Movement</DialogTitle>
          <DialogDescription>
            {fundAccountName} — record an inflow or outflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Movement Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FUNDING">Funding (In)</SelectItem>
                <SelectItem value="REPAYMENT">Repayment (In)</SelectItem>
                <SelectItem value="DISBURSEMENT">Disbursement (Out)</SelectItem>
                <SelectItem value="WITHDRAWAL">Withdrawal (Out)</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount (₦) *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`${direction === "IN" ? "Money in" : "Money out"}...`}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={isInflow ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={isPending || amount <= 0}
          >
            {isPending ? "Recording..." : `Record ${direction}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
