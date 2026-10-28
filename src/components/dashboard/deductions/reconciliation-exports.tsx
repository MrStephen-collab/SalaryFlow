"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  exportReconciliationCSV,
  exportReconciliationTemplate,
} from "@/app/dashboard/deductions/actions";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReconciliationExports({ periodId }: { periodId: string }) {
  const [isPending, startTransition] = useTransition();
  const suffix = periodId.slice(0, 8);

  const handleExport = (kind: "reconciliation" | "template") => {
    startTransition(async () => {
      if (kind === "template") {
        const csv = await exportReconciliationTemplate(periodId);
        downloadCsv(csv, `reconciliation-template-${suffix}.csv`);
        toast.success("Template downloaded");
        return;
      }

      const csv = await exportReconciliationCSV(periodId);
      downloadCsv(csv, `reconciliation-${suffix}.csv`);
      toast.success("Reconciliation exported");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => handleExport("template")}
        disabled={isPending}
      >
        <FileSpreadsheet className="size-4" />
        Template
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport("reconciliation")}
        disabled={isPending}
      >
        <Download className="size-4" />
        {isPending ? "Exporting..." : "Export"}
      </Button>
    </div>
  );
}
