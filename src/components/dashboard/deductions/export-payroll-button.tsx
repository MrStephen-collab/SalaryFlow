"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { exportPayrollCSV } from "@/app/dashboard/deductions/actions";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ExportPayrollButton({ periodId }: { periodId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const csv = await exportPayrollCSV(periodId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payroll-${periodId.slice(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Payroll exported");
    });
  };

  return (
    <Button onClick={handleExport} disabled={isPending} variant="outline">
      <Download className="size-4" />
      {isPending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}