"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deletePlan } from "@/app/super-admin/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, Trash2 } from "lucide-react";

export function DeletePlanButton({
  planId,
  planName,
  onDeleted,
}: {
  planId: string;
  planName: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deletePlan(planId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      onDeleted?.();
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Delete ${planName}`}
          title={`Delete ${planName}`}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      }
      title={`Delete ${planName}?`}
      description="This permanently removes the plan. Plans assigned to an organization cannot be deleted; deactivate them instead."
      confirmLabel="Delete plan"
      destructive
      onConfirm={remove}
    />
  );
}
