"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reviewThriftRequest } from "@/app/dashboard/employees/thrift-actions";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X } from "lucide-react";

export function ThriftRequestActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status !== "PENDING") return null;

  function act(approve: boolean) {
    startTransition(async () => {
      const result = await reviewThriftRequest(id, approve);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update the request");
        return;
      }
      toast.success(
        approve ? "Thrift released to the employee's wallet" : "Request rejected"
      );
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" onClick={() => act(true)} disabled={isPending}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Release
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => act(false)}
        disabled={isPending}
      >
        <X className="size-4" />
        Reject
      </Button>
    </div>
  );
}
