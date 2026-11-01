"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SalaryImportRow } from "@/schemas/salary";
import { importSalary } from "@/app/dashboard/salary/actions";
import { parseSalaryFile } from "@/lib/salary-import";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, UploadCloud, CheckCircle2, XCircle } from "lucide-react";

interface PeriodOption {
  id: string;
  name: string;
}

interface EmployeeOption {
  employee_number: string;
  first_name: string;
  last_name: string;
}

interface ParsedRow {
  employeeNumber: string;
  employeeName: string;
  basicSalary: number;
  allowances: number;
  otherDeductions: number;
  status: "VALID" | "DUPLICATE" | "INVALID";
  error?: string;
}

export function SalaryImporter({
  periods,
  employees,
}: {
  periods: PeriodOption[];
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const employeeNumbers = useMemo(
    () => new Set(employees.map((e) => e.employee_number.toLowerCase())),
    [employees]
  );

  const employeeByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employees) {
      const key = `${employee.first_name} ${employee.last_name}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ");
      map.set(key, employee.employee_number);
    }
    return map;
  }, [employees]);

  const handleFile = async (file: File) => {
    setError(null);
    setNote(null);
    setFilename(file.name);

    const result = await parseSalaryFile(file);
    if (result.error) {
      setError(result.error);
      setRows([]);
      return;
    }
    if (result.note) setNote(result.note);

    const seen = new Set<string>();
    const parsed: ParsedRow[] = result.rows.map((r) => {
      let employeeNumber = r.employeeNumber.trim();

      if (!employeeNumber || !employeeNumbers.has(employeeNumber.toLowerCase())) {
        const nameKey = r.employeeName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ");
        const matched = employeeByName.get(nameKey);
        if (matched) employeeNumber = matched;
      }

      if (!employeeNumber) {
        return { ...r, status: "INVALID", error: "Missing employee identifier" };
      }
      if (!employeeNumbers.has(employeeNumber.toLowerCase())) {
        return {
          ...r,
          status: "INVALID",
          error: `Employee "${employeeNumber || r.employeeName}" not found`,
        };
      }
      if (seen.has(employeeNumber.toLowerCase())) {
        return { ...r, status: "DUPLICATE", error: "Duplicate employee" };
      }
      seen.add(employeeNumber.toLowerCase());
      if (r.basicSalary <= 0) {
        return { ...r, status: "INVALID", error: "Basic salary must be > 0" };
      }
      return { ...r, employeeNumber, status: "VALID" };
    });

    setRows(parsed);
  };

  function downloadTemplate() {
    const csv =
      "Employee Number,Employee Name,Basic Salary,Allowances,Other Deductions\n" +
      "EMP-001,Jane Doe,250000,20000,5000\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "salary-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = useMemo(() => {
    const valid = rows.filter((r) => r.status === "VALID").length;
    const duplicates = rows.filter((r) => r.status === "DUPLICATE").length;
    const invalid = rows.filter((r) => r.status === "INVALID").length;
    return { total: rows.length, valid, duplicates, invalid };
  }, [rows]);

  const handleImport = () => {
    if (!periodId) {
      toast.error("Select a salary period");
      return;
    }
    const validRows = rows.filter((r) => r.status === "VALID");
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    startTransition(async () => {
      const payload: SalaryImportRow[] = validRows.map((r) => ({
        employeeNumber: r.employeeNumber,
        basicSalary: r.basicSalary,
        allowances: r.allowances,
        otherDeductions: r.otherDeductions,
      }));
      const result = await importSalary({ periodId, rows: payload });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.push(`/dashboard/salary/${periodId}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-5" />
              Upload Salary File
            </CardTitle>
            <CardDescription>
              Upload a CSV/XLSX file with employee salaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Salary Period</label>
              <Select value={periodId} onValueChange={(v) => setPeriodId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period">
                    {(value) =>
                      periods.find((p) => p.id === value)?.name ?? "Select period"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted"
              htmlFor="salary-file"
            >
              <FileUp className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {filename || "Click to upload CSV or Excel"}
              </span>
              <span className="text-xs text-muted-foreground">
                Standard template: Employee Number/Name, Basic Salary,
                Allowances, Other Deductions. Bank schedules with
                Name/Staff ID/Amount also work.
              </span>
              <input
                id="salary-file"
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <FileUp className="size-4" />
              Download template
            </Button>

            {note && (
              <Alert>
                <AlertDescription>{note}</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Summary</CardTitle>
            <CardDescription>
              Validation results for the uploaded file
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-2xl font-bold text-green-700">
                  {counts.valid}
                </p>
                <p className="text-xs text-green-700">Valid</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-2xl font-bold text-red-700">
                  {counts.invalid + counts.duplicates}
                </p>
                <p className="text-xs text-red-700">Invalid / Duplicate</p>
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={isPending || counts.valid === 0 || !periodId}
              className="w-full"
            >
              {isPending
                ? "Importing..."
                : `Import ${counts.valid} valid record${counts.valid === 1 ? "" : "s"}`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Employee No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Allowances</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <CollapsibleTableBody columns={7} limit={5} itemLabel="rows">
              {rows.slice(0, 100).map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {r.status === "VALID" ? (
                      <Badge className="bg-green-600">
                        <CheckCircle2 className="size-3" />
                        VALID
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="size-3" />
                        {r.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.employeeNumber}
                  </TableCell>
                  <TableCell>{r.employeeName}</TableCell>
                  <TableCell className="text-right">
                    ₦{r.basicSalary.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ₦{r.allowances.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ₦{r.otherDeductions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </CollapsibleTableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
