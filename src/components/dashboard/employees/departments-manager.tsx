"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
} from "@/app/dashboard/employees/actions";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CollapsibleList } from "@/components/ui/collapsible-list";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

type Department = { id: string; name: string };

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; department: Department }
  | { mode: "delete"; department: Department };

export function DepartmentsManager({
  departments,
}: {
  departments: Department[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const openCreate = () => {
    setName("");
    setDialog({ mode: "create" });
  };

  const openEdit = (department: Department) => {
    setName(department.name);
    setDialog({ mode: "edit", department });
  };

  const openDelete = (department: Department) => {
    setDialog({ mode: "delete", department });
  };

  const closeDialog = () => {
    if (!isPending) setDialog(null);
  };

  const handleSubmit = () => {
    if (!dialog || dialog.mode === "delete") return;
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    startTransition(async () => {
      const result =
        dialog.mode === "create"
          ? await createDepartmentAction(name)
          : await updateDepartmentAction(dialog.department.id, name);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      setDialog(null);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (dialog?.mode !== "delete") return;

    startTransition(async () => {
      const result = await deleteDepartmentAction(dialog.department.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      setDialog(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize your employees by department
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Department
        </Button>
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
        <CollapsibleList
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          limit={9}
          itemLabel="departments"
        >
          {departments.map((department) => (
            <Card key={department.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="pt-1 text-base">
                  {department.name}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 text-muted-foreground"
                        aria-label="Department actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(department)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => openDelete(department)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
            </Card>
          ))}
        </CollapsibleList>
      )}

      {/* One shared dialog for every card, kept centered in the viewport. */}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {dialog?.mode === "delete" ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete Department</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{dialog.department.name}
                  &quot;? This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialog?.mode === "edit" ? "Edit Department" : "Add Department"}
                </DialogTitle>
                <DialogDescription>
                  {dialog?.mode === "edit"
                    ? "Update department name."
                    : "Create a new department for your organization."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="department-name">Department Name</Label>
                <Input
                  id="department-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit();
                  }}
                  placeholder="e.g. Front Desk"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isPending}>
                  {isPending
                    ? "Saving..."
                    : dialog?.mode === "edit"
                      ? "Save"
                      : "Add"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
