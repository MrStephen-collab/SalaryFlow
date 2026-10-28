"use client";

import { Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReceiptActions({
  receiptUrl,
  verifyUrl,
}: {
  receiptUrl: string;
  verifyUrl: string;
}) {
  async function share() {
    const shareData = {
      title: "SalaryFlow receipt",
      text: "Verify this SalaryFlow receipt",
      url: verifyUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fall through to copying the link.
      }
    }

    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast.success("Verification link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => window.print()}>
        <Printer />
        Print / Save PDF
      </Button>
      <Button variant="outline" onClick={share}>
        <Share2 />
        Share
      </Button>
      <Button
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(receiptUrl);
            toast.success("Receipt link copied");
          } catch {
            toast.error("Could not copy the link");
          }
        }}
      >
        Copy receipt link
      </Button>
    </div>
  );
}
