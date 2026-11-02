"use client";

import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StatementActions({
  downloadHref,
  printHref,
  shareUrl,
}: {
  downloadHref: string;
  printHref: string;
  shareUrl: string;
}) {
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "SalaryFlow statement",
          text: "My SalaryFlow account statement",
          url: shareUrl,
        });
        return;
      } catch {
        // Fall through to copying the link.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Statement link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        variant="outline"
        render={
          <a href={printHref} target="_blank" rel="noopener noreferrer" />
        }
      >
        <Printer />
        Print / Save PDF
      </Button>
      <Button variant="outline" render={<a href={downloadHref} />}>
        <Download />
        Download CSV
      </Button>
      <Button variant="ghost" onClick={share}>
        <Share2 />
        Share
      </Button>
    </div>
  );
}
