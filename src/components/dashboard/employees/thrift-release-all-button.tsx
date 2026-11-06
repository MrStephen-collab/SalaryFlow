"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { releaseAllThriftToWallets } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, PiggyBank } from "lucide-react";

/** Chairman-only bulk action: release every enabled employee's thrift savings. */
export function ThriftReleaseAllButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function releaseAll() {
    startTransition(async () => {
      const result = await releaseAllThriftToWallets();
      if (!result.ok) {
        toast.error(result.error ?? "Could not release thrift savings");
        return;
      }
      if (result.released === 0) {
        toast.info("No thrift savings to release");
      } else {
        toast.success(
          `${result.released} employee(s) · ${new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 2,
          }).format(result.total ?? 0)} released to wallets${
            result.failures ? ` · ${result.failures} failed` : ""
          }`
        );
      }
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PiggyBank className="size-4" />
          )}
          {isPending ? "Releasing…" : "Release all thrift"}
        </Button>
      }
      title="Release every employee's thrift?"
      description="Every employee with a thrift balance, including former employees, will have it moved into their withdrawable wallet. This cannot be undone from the app."
      confirmLabel="Release all"
      destructive
      onConfirm={releaseAll}
    />
  );
}
