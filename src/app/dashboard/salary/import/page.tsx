import type { Metadata } from "next";
import Link from "next/link";
import { SalaryService } from "@/services/salary-service";
import { SalaryImporter } from "@/components/dashboard/salary/salary-importer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Import Salary",
};

export default async function SalaryImportPage() {
  const service = await SalaryService.create();
  const [periods, employees] = await Promise.all([
    service.listPeriods(),
    service.listEmployeeIdentifiers(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Salary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload salaries for a payroll period
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/salary" />}>
          <ArrowLeft className="size-4" />
          Back to Salary
        </Button>
      </div>

      <SalaryImporter periods={periods} employees={employees} />
    </div>
  );
}
