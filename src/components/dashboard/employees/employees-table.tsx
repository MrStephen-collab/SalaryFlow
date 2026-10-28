"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeForm } from "@/components/dashboard/employees/employee-form";
import { toggleEmployeeStatus } from "@/app/dashboard/employees/actions";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Search, UserX } from "lucide-react";
import { EMPLOYMENT_STATUSES } from "@/config/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface EmployeeRow {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  employment_status: string;
  employment_type: string;
  date_joined: string;
  branch_id: string | null;
  branch?: { name: string } | null;
  users?: { email: string | null; full_name: string | null } | null;
}

interface EmployeesTableProps {
  employees: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
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

export function EmployeesTable({
  employees,
  total,
  page,
  pageSize,
  totalPages,
  departments,
  branches,
}: EmployeesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [isPending, startTransition] = useTransition();

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    router.push(`/dashboard/employees?${params.toString()}`);
  };

  const handleSearch = () => {
    updateParams({ search });
  };

  const handleStatusToggle = (id: string) => {
    startTransition(async () => {
      const result = await toggleEmployeeStatus(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, number, email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Select
            value={searchParams.get("status") ?? ""}
            onValueChange={(v) => updateParams({ status: v || null })}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {EMPLOYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {(searchParams.get("search") ||
            searchParams.get("status") ||
            searchParams.get("department") ||
            searchParams.get("page")) && (
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/employees")}
            >
              Clear
            </Button>
          )}
          <EmployeeForm departments={departments} branches={branches} />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>No.</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <p className="text-sm font-medium">No employees found</p>
                  <p className="text-sm text-muted-foreground">
                    Add your first employee to get started.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => {
                const initials = `${employee.first_name?.[0] ?? ""}${
                  employee.last_name?.[0] ?? ""
                }`.toUpperCase();
                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {employee.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {employee.employee_number}
                    </TableCell>
                    <TableCell>{employee.department ?? "—"}</TableCell>
                    <TableCell>{employee.position ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(employee.employment_status)}>
                        {employee.employment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{employee.date_joined}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                          >
                            <Pencil className="size-4" />
                            View profile
                          </DropdownMenuItem>
                          <EmployeeForm
                            employee={{
                              id: employee.id,
                              employee_number: employee.employee_number,
                              first_name: employee.first_name,
                              last_name: employee.last_name,
                              other_names: employee.other_names,
                              email: employee.email,
                              phone: employee.phone,
                              date_of_birth: null,
                              gender: null,
                              address: null,
                              state: null,
                              lga: null,
                              department: employee.department,
                              position: employee.position,
                              employment_type: employee.employment_type,
                              employment_status: employee.employment_status,
                              date_joined: employee.date_joined,
                              branch_id: employee.branch_id,
                            }}
                            departments={departments}
                            branches={branches}
                          />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => handleStatusToggle(employee.id)}
                          >
                            <UserX className="size-4" />
                            {employee.employment_status === "Suspended"
                              ? "Reactivate"
                              : "Suspend"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          {total === 0 ? 0 : (page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, total)} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(page - 1));
              router.push(`/dashboard/employees?${params.toString()}`);
            }}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(page + 1));
              router.push(`/dashboard/employees?${params.toString()}`);
            }}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
