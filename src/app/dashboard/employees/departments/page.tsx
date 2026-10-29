import type { Metadata } from "next";
import { EmployeeService } from "@/services/employee-service";
import { DepartmentsManager } from "@/components/dashboard/employees/departments-manager";

export const metadata: Metadata = {
  title: "Departments",
};

export default async function DepartmentsPage() {
  const service = await EmployeeService.create();
  const departments = await service.listDepartments();

  return <DepartmentsManager departments={departments} />;
}
