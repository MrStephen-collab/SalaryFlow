"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { releaseThriftToWallet } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, Send } from "lucide-react";

/**
 * Chairman-only action: move thrift savings into the withdrawable wallet.
 */
export function ThriftReleaseButton({
  employeeId,
  disabled,
}: {
  employeeId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function release() {
    startTransition(async () => {
      const result = await releaseThriftToWallet(employeeId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not release thrift savings");
        return;
      }
      toast.success(
        new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          maximumFractionDigits: 2,
        }).format(result.amount ?? 0) + " released to the wallet"
      );
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button disabled={disabled || isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {isPending ? "Releasing…" : "Release to wallet"}
        </Button>
      }
      title="Release thrift savings?"
      description="The employee's entire thrift balance will move into their withdrawable wallet. This cannot be undone from the app."
      confirmLabel="Release"
      destructive
      onConfirm={release}
    />
  );
}
