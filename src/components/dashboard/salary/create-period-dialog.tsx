"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createSalaryPeriodSchema,
  type CreateSalaryPeriodValues,
} from "@/schemas/salary";
import { createSalaryPeriod } from "@/app/dashboard/salary/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

function FieldError({
  errors,
  name,
}: {
  errors: FieldErrors<CreateSalaryPeriodValues>;
  name: keyof CreateSalaryPeriodValues;
}) {
  const error = errors[name];
  if (!error?.message) return null;
  return <p className="text-sm text-destructive">{error.message}</p>;
}

function monthName(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function CreatePeriodDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateSalaryPeriodValues>({
    resolver: zodResolver(createSalaryPeriodSchema),
    defaultValues: {
      name: monthName(defaultStart),
      startDate: defaultStart,
      endDate: defaultEnd,
      paymentDate: defaultEnd,
    },
  });

  const onSubmit = (values: CreateSalaryPeriodValues) => {
    startTransition(async () => {
      const result = await createSalaryPeriod(values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Create Period
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Salary Period</DialogTitle>
          <DialogDescription>
            Create a new payroll period for your organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Period Name</Label>
            <Input
              placeholder="e.g. January 2026"
              {...register("name")}
            />
            <FieldError errors={errors} name="name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                {...register("startDate")}
                onChange={(e) => {
                  register("startDate").onChange(e);
                  setValue("name", monthName(e.target.value));
                }}
              />
              <FieldError errors={errors} name="startDate" />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" {...register("endDate")} />
              <FieldError errors={errors} name="endDate" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input type="date" {...register("paymentDate")} />
            <FieldError errors={errors} name="paymentDate" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Period"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
