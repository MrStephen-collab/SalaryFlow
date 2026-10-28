"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshOverdue } from "@/app/dashboard/collections/actions";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RefreshOverdueButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const result = await refreshOverdue();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Overdue refresh complete");
      router.refresh();
    });
  };

  return (
    <Button size="sm" onClick={handleRefresh} disabled={isPending}>
      <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
      {isPending ? "Refreshing..." : "Refresh overdue"}
    </Button>
  );
}
