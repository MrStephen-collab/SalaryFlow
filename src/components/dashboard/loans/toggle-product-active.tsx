"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleLoanProductActive } from "@/app/dashboard/loans/actions";
import { Switch } from "@/components/ui/switch";

export function ToggleProductActive({
  productId,
  active,
}: {
  productId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      const result = await toggleLoanProductActive(productId, checked);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.refresh();
      }
    });
  };

  return (
    <Switch
      checked={active}
      onCheckedChange={handleToggle}
      disabled={isPending}
    />
  );
}
