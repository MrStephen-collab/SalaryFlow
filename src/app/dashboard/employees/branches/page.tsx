import type { Metadata } from "next";
import { EmployeeService } from "@/services/employee-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddBranchDialog } from "@/components/dashboard/employees/add-branch-dialog";
import { ManageBranch } from "@/components/dashboard/employees/manage-branch";

export const metadata: Metadata = {
  title: "Branches",
};

export default async function BranchesPage() {
  const service = await EmployeeService.create();
  const branches = await service.listBranches();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organization&apos;s branches
          </p>
        </div>
        <AddBranchDialog />
      </div>

      {branches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No branches yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first branch to organize employees by location.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base">{branch.name}</CardTitle>
                <ManageBranch
                  branch={{
                    id: branch.id,
                    name: branch.name,
                    address: branch.address ?? null,
                  }}
                />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {branch.address ?? "No address set"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
