import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmployeeService } from "@/services/employee-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/dashboard/employees/employee-form";
import { NinVerification } from "@/components/nin/nin-verification";

export const metadata: Metadata = {
  title: "Employee Profile",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function statusVariant(status: string) {
  switch (status) {
    case "Active":
      return "default" as const;
    case "Suspended":
      return "destructive" as const;
    case "On Leave":
      return "secondary" as const;
    case "Resigned":
    case "Terminated":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

type EmployeeRow = {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  state: string | null;
  lga: string | null;
  nin: string | null;
  nin_document_url: string | null;
  nin_status: string | null;
  department: string | null;
  position: string | null;
  employment_type: string;
  employment_status: string;
  date_joined: string;
  confirmation_date: string | null;
  termination_date: string | null;
  branch_id: string | null;
  salary: number | null;
  job_title: string | null;
  branch?: string | null;
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const service = await EmployeeService.create();
  const [employee, departments, branches] = await Promise.all([
    service.getById(employeeId),
    service.listDepartments(),
    service.listBranches(),
  ]);

  if (!employee) {
    notFound();
  }

  const employeeRow = employee as EmployeeRow;
  const initials = `${employeeRow.first_name?.[0] ?? ""}${
    employeeRow.last_name?.[0] ?? ""
  }`.toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            render={<Link href="/dashboard/employees" />}
          >
            <ArrowLeft className="size-4" />
            Back to employees
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {employeeRow.first_name} {employeeRow.last_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employeeRow.position ?? "No position set"} · {employeeRow.employee_number}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EmployeeForm
            employee={{
              id: employeeRow.id,
              employee_number: employeeRow.employee_number,
              first_name: employeeRow.first_name,
              last_name: employeeRow.last_name,
              other_names: employeeRow.other_names,
              email: employeeRow.email,
              phone: employeeRow.phone,
              date_of_birth: employeeRow.date_of_birth,
              gender: employeeRow.gender as "" | "Male" | "Female" | "Other" | null,
              address: employeeRow.address,
              state: employeeRow.state,
              lga: employeeRow.lga,
              nin: employeeRow.nin,
              nin_document_url: employeeRow.nin_document_url,
              department: employeeRow.department,
              position: employeeRow.position,
              employment_type: employeeRow.employment_type,
              employment_status: employeeRow.employment_status,
              date_joined: employeeRow.date_joined,
              salary: employeeRow.salary ?? 0,
              branch_id: employeeRow.branch_id,
            }}
            departments={departments}
            branches={branches}
          />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-6 sm:flex-row">
          <Avatar className="h-20 w-20">
            <AvatarImage src="" />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-lg font-semibold">
                {employeeRow.first_name} {employeeRow.last_name}
              </span>
              <Badge variant={statusVariant(employeeRow.employment_status)}>
                {employeeRow.employment_status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{employeeRow.job_title ?? "—"}</p>
            {employeeRow.salary && (
              <p className="mt-1 text-lg font-semibold">
                {naira(employeeRow.salary)}
                <span className="text-xs font-normal text-muted-foreground"> / mo</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Contact and identification details</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" value={employeeRow.phone} />
            <Field label="Email" value={employeeRow.email} />
            <Field label="Date of Birth" value={employeeRow.date_of_birth} />
            <Field label="Gender" value={employeeRow.gender} />
            <Field label="State" value={employeeRow.state} />
            <Field label="LGA" value={employeeRow.lga} />
            <div className="sm:col-span-2">
              <Field label="Address" value={employeeRow.address} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
            <CardDescription>Job and organizational information</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee No." value={employeeRow.employee_number} />
            <Field label="Department" value={employeeRow.department} />
            <Field label="Position" value={employeeRow.position} />
            <Field label="Job Title" value={employeeRow.job_title} />
            <Field label="Employment Type" value={employeeRow.employment_type} />
            <Field label="Branch" value={employeeRow.branch} />
            <Field label="Date Joined" value={employeeRow.date_joined} />
            <Field
              label="Confirmation Date"
              value={employeeRow.confirmation_date}
            />
            <Field
              label="Termination Date"
              value={employeeRow.termination_date}
            />
            <Field label="Monthly Salary" value={naira(employeeRow.salary ?? 0)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">NIN Verification</CardTitle>
          <CardDescription>
            Review and verify the employee&apos;s National Identification Number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NinVerification
            kind="employee"
            id={employeeRow.id}
            nin={employeeRow.nin}
            documentUrl={employeeRow.nin_document_url}
            status={employeeRow.nin_status}
          />
        </CardContent>
      </Card>
    </div>
  );
}