"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { verifyNin, type NinRecordKind } from "@/app/nin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

function NinStatusBadge({ status }: { status: string }) {
  if (status === "VERIFIED") {
    return <Badge variant="default">Verified</Badge>;
  }
  if (status === "REJECTED") {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

/**
 * Admin controls to review a submitted NIN: shows the status and offers
 * verify/reject actions plus a link to the uploaded document.
 */
export function NinVerification({
  kind,
  id,
  nin,
  documentUrl,
  status,
}: {
  kind: NinRecordKind;
  id: string;
  nin?: string | null;
  documentUrl?: string | null;
  status?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentStatus = status ?? "PENDING";

  function act(next: "VERIFIED" | "REJECTED") {
    startTransition(async () => {
      const result = await verifyNin(kind, id, next);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "NIN updated");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-muted-foreground">{nin ?? "—"}</span>
        <NinStatusBadge status={currentStatus} />
        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline underline-offset-2"
          >
            View document
          </a>
        ) : null}
      </div>
      {currentStatus !== "VERIFIED" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => act("VERIFIED")}
          >
            <Check className="size-3.5" />
            Verify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => act("REJECTED")}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
