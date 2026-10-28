import type { Metadata } from "next";
import { EmployeeService } from "@/services/employee-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddDepartmentDialog } from "@/components/dashboard/employees/add-department-dialog";
import { ManageDepartment } from "@/components/dashboard/employees/manage-department";

export const metadata: Metadata = {
  title: "Departments",
};

export default async function DepartmentsPage() {
  const service = await EmployeeService.create();
  const departments = await service.listDepartments();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize your employees by department
          </p>
        </div>
        <AddDepartmentDialog />
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No departments yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first department to organize employees.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <Card key={department.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="pt-1 text-base">
                  {department.name}
                </CardTitle>
                <ManageDepartment
                  department={{ id: department.id, name: department.name }}
                />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
