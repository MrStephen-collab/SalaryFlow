import type { Metadata } from "next";
import { EmployeeService } from "@/services/employee-service";
import {
  EmployeesTable,
  type EmployeeRow,
} from "@/components/dashboard/employees/employees-table";

export const metadata: Metadata = {
  title: "Employees",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    department?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const service = await EmployeeService.create();
  const [result, departments, branches] = await Promise.all([
    service.list({
      search: params.search,
      status: params.status,
      department: params.department,
      page: params.page ? Number(params.page) : 1,
    }),
    service.listDepartments(),
    service.listBranches(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization&apos;s employees
        </p>
      </div>

      <EmployeesTable
        employees={result.data as unknown as EmployeeRow[]}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        departments={departments}
        branches={branches}
      />
    </div>
  );
}
