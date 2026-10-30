"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { releaseAllThriftToWallets } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
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
    <Button variant="outline" onClick={releaseAll} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <PiggyBank className="size-4" />
      )}
      {isPending ? "Releasing…" : "Release all thrift"}
    </Button>
  );
}
