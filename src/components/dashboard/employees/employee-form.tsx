"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  Controller,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createEmployeeSchema,
  type CreateEmployeeValues,
} from "@/schemas/employee";
import { createEmployee, updateEmployee } from "@/app/dashboard/employees/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from "@/config/constants";
import { getLgasForState, NIGERIA_STATES } from "@/config/nigeria";
import { NinDocumentInput } from "@/components/nin/nin-document-input";

interface EmployeeFormProps {
  employee?: {
    id: string;
    employee_number: string;
    first_name: string;
    last_name: string;
    other_names: string | null;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
    gender: "" | "Male" | "Female" | "Other" | null;
    address: string | null;
    state: string | null;
    lga: string | null;
    nin: string | null;
    nin_document_url: string | null;
    department: string | null;
    position: string | null;
    employment_type: string;
    employment_status: string;
    date_joined: string;
    salary: number;
    thrift_enabled: boolean;
    thrift_amount: number;
    branch_id: string | null;
  };
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}

function FieldError({
  errors,
  name,
}: {
  errors: FieldErrors<CreateEmployeeValues>;
  name: keyof CreateEmployeeValues;
}) {
  const error = errors[name];
  if (!error?.message) return null;
  return <p className="text-sm text-destructive">{error.message}</p>;
}

function FormFieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <Label className="mb-1.5 block text-sm font-medium">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

export function EmployeeForm({
  employee,
  departments,
  branches,
}: EmployeeFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEdit = Boolean(employee);

  const defaultValues: CreateEmployeeValues = employee
    ? {
        employeeNumber: employee.employee_number,
        firstName: employee.first_name,
        lastName: employee.last_name,
        otherNames: employee.other_names ?? "",
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        dateOfBirth: employee.date_of_birth ?? "",
        gender: employee.gender ?? "",
        address: employee.address ?? "",
        state: employee.state ?? "",
        lga: employee.lga ?? "",
        nin: employee.nin ?? "",
        ninDocumentUrl: employee.nin_document_url ?? "",
        department: employee.department ?? "",
        position: employee.position ?? "",
        employmentType:
          (employee.employment_type as CreateEmployeeValues["employmentType"]) ??
          "Full-time",
        employmentStatus:
          (employee.employment_status as CreateEmployeeValues["employmentStatus"]) ??
          "Active",
        dateJoined: employee.date_joined,
        salary: employee.salary ?? 0,
        thriftEnabled: employee.thrift_enabled ?? false,
        thriftAmount: employee.thrift_amount ?? 0,
        branchId: employee.branch_id ?? "",
      }
    : {
        employeeNumber: "",
        firstName: "",
        lastName: "",
        otherNames: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        gender: "",
        address: "",
        state: "",
        lga: "",
        nin: "",
        ninDocumentUrl: "",
        department: "",
        position: "",
        employmentType: "Full-time",
        employmentStatus: "Active",
        dateJoined: new Date().toISOString().split("T")[0],
        salary: 0,
        thriftEnabled: false,
        thriftAmount: 0,
        branchId: "",
      };

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateEmployeeValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues,
  });

  const selectedState = useWatch({ control, name: "state" });
  const stateLgas = selectedState ? getLgasForState(selectedState) : [];
  const thriftEnabled = useWatch({ control, name: "thriftEnabled" });

  const onSubmit = (values: CreateEmployeeValues) => {
    if (!values.nin?.trim()) {
      toast.error("NIN is required");
      return;
    }
    if (!/^\d{11}$/.test(values.nin)) {
      toast.error("NIN must be 11 digits");
      return;
    }
    if (!values.ninDocumentUrl) {
      toast.error("Please upload the NIN document");
      return;
    }

    startTransition(async () => {
      if (isEdit && employee) {
        const result = await updateEmployee(employee.id, values);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(result.success ?? "Employee updated");
          setOpen(false);
          router.refresh();
        }
      } else {
        const result = await createEmployee(values);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(result.success ?? "Employee created");
          setOpen(false);
          reset();
          router.refresh();
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            {isEdit ? "Edit" : "Add Employee"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the employee details."
              : "Add a new employee to your organization."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormFieldLabel>Employee No.</FormFieldLabel>
                <Input placeholder="Auto (e.g. EMP-0039)" {...register("employeeNumber")} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank to allocate the next number. You can edit it later.
                </p>
                <FieldError errors={errors} name="employeeNumber" />
              </div>
              <div>
                <FormFieldLabel required>Date Joined</FormFieldLabel>
                <Input type="date" {...register("dateJoined")} />
                <FieldError errors={errors} name="dateJoined" />
              </div>
              <div>
                <FormFieldLabel>Status</FormFieldLabel>
                <Controller
                  control={control}
                  name="employmentStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormFieldLabel required>First Name</FormFieldLabel>
                <Input placeholder="John" {...register("firstName")} />
                <FieldError errors={errors} name="firstName" />
              </div>
              <div>
                <FormFieldLabel required>Last Name</FormFieldLabel>
                <Input placeholder="Doe" {...register("lastName")} />
                <FieldError errors={errors} name="lastName" />
              </div>
              <div>
                <FormFieldLabel>Other Names</FormFieldLabel>
                <Input placeholder="Optional" {...register("otherNames")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Email</FormFieldLabel>
                <Input
                  type="email"
                  placeholder="john@company.com"
                  {...register("email")}
                />
                <FieldError errors={errors} name="email" />
              </div>
              <div>
                <FormFieldLabel>Phone</FormFieldLabel>
                <Input placeholder="+234..." {...register("phone")} />
              </div>
            </div>

            <div>
              <FormFieldLabel>Address</FormFieldLabel>
              <Textarea
                placeholder="Full street address"
                rows={2}
                {...register("address")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel required>NIN</FormFieldLabel>
                <Input
                  placeholder="11-digit NIN"
                  inputMode="numeric"
                  maxLength={11}
                  {...register("nin")}
                />
                <FieldError errors={errors} name="nin" />
              </div>
              <div>
                <FormFieldLabel required>NIN Document</FormFieldLabel>
                <Controller
                  control={control}
                  name="ninDocumentUrl"
                  render={({ field }) => (
                    <NinDocumentInput
                      value={field.value}
                      onChange={(url) => field.onChange(url ?? "")}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormFieldLabel>State</FormFieldLabel>
                <Controller
                  control={control}
                  name="state"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("lga", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIGERIA_STATES.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <FormFieldLabel>LGA</FormFieldLabel>
                <Controller
                  control={control}
                  name="lga"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={!selectedState || stateLgas.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedState ? "Select LGA" : "Select state first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {stateLgas.map((lga) => (
                          <SelectItem key={lga} value={lga}>
                            {lga}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={errors} name="lga" />
              </div>
              <div>
                <FormFieldLabel>Gender</FormFieldLabel>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormFieldLabel>Department</FormFieldLabel>
                <Controller
                  control={control}
                  name="department"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <FormFieldLabel>Position</FormFieldLabel>
                <Input placeholder="Engineer" {...register("position")} />
              </div>
              <div>
                <FormFieldLabel>Employment Type</FormFieldLabel>
                <Controller
                  control={control}
                  name="employmentType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Branch</FormFieldLabel>
                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(value) => {
                            const selected = branches.find(
                              (b) => b.id === value
                            );
                            return selected ? selected.name : "Select";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <FormFieldLabel>Monthly Salary (₦)</FormFieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 250000"
                  {...register("salary")}
                />
                <FieldError errors={errors} name="salary" />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <FormFieldLabel>Thrift Savings</FormFieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Voluntary savings taken from salary after loan deductions.
                    Activate it when the employee asks for it.
                  </p>
                </div>
                <Controller
                  control={control}
                  name="thriftEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={(value) => field.onChange(Boolean(value))}
                    />
                  )}
                />
              </div>
              {thriftEnabled ? (
                <div>
                  <FormFieldLabel>Amount per Salary (₦)</FormFieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 20000"
                    {...register("thriftAmount")}
                  />
                  <FieldError errors={errors} name="thriftAmount" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    This amount is set aside after loan deductions on every
                    salary run. Only the chairman can release it to the wallet.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
