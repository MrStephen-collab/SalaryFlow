"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveMemberMembership } from "@/app/dashboard/members/actions";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function MemberApprovalActions({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveMemberMembership(memberId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.already ? "Membership already approved" : "Membership approved");
      }
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={approve} disabled={isPending}>
      <Check className="size-4" />
      Approve
    </Button>
  );
}
