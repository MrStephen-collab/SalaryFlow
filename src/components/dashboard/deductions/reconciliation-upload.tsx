"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importPayrollActualsCsv } from "@/app/dashboard/deductions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

export function ReconciliationUpload({ periodId }: { periodId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");

  const reset = () => {
    setFileName("");
    setCsv("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error("Choose a .csv file exported from your payroll system");
      return;
    }
    try {
      const text = await file.text();
      setCsv(text);
      setFileName(file.name);
    } catch {
      toast.error("Could not read that file");
    }
  };

  const handleImport = () => {
    if (!csv) {
      toast.error("Choose a CSV file first");
      return;
    }
    startTransition(async () => {
      const result = await importPayrollActualsCsv(periodId, csv);
      if (!("success" in result)) {
        toast.error(result.error);
        const unknown = "unknown" in result ? result.unknown ?? [] : [];
        const noPayroll = "noPayroll" in result ? result.noPayroll ?? [] : [];
        if (unknown.length > 0) {
          toast.warning(`Unknown employee numbers: ${unknown.join(", ")}`);
        }
        if (noPayroll.length > 0) {
          toast.warning(`No salary record: ${noPayroll.join(", ")}`);
        }
        return;
      }

      toast.success(result.success);
      const unknown = result.unknown ?? [];
      const noPayroll = result.noPayroll ?? [];
      if (unknown.length > 0) {
        toast.warning(
          `Skipped unknown employee numbers: ${unknown.join(", ")}`
        );
      }
      if (noPayroll.length > 0) {
        toast.warning(`No salary record imported for: ${noPayroll.join(", ")}`);
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Upload className="size-4" />
            Upload payroll report
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload payroll report</DialogTitle>
          <DialogDescription>
            Import the actual loan deductions for this period. Expected amounts
            are not changed — only the reported figure is recorded.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-dashed p-4">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFile(event.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              CSV with <code>employee_number</code> and{" "}
              <code>actual_deduction</code> columns. Header row optional.
            </p>
            {fileName ? (
              <p className="mt-2 text-xs font-medium">Selected: {fileName}</p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isPending || !csv}>
            {isPending ? "Importing..." : "Import actuals"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
