"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveMemberWithdrawal,
  payMemberWithdrawal,
} from "@/app/dashboard/members/actions";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Send } from "lucide-react";

export function MemberWithdrawalActions({
  withdrawalId,
  status,
}: {
  withdrawalId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: "approve" | "pay") {
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveMemberWithdrawal(withdrawalId)
          : await payMemberWithdrawal(withdrawalId);
      if (!result.ok) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      toast.success(result.success ?? "Updated");
      router.refresh();
    });
  }

  if (status === "PENDING") {
    return (
      <Button size="sm" onClick={() => run("approve")} disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Approve
      </Button>
    );
  }

  if (status === "APPROVED") {
    return (
      <Button size="sm" onClick={() => run("pay")} disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Mark paid
      </Button>
    );
  }

  return null;
}
