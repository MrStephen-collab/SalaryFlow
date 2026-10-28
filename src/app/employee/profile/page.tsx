import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { EmployeePortalService } from "@/services/employee-portal-service";
import { ProfileService } from "@/services/profile-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarUpload } from "@/components/employee/profile/avatar-upload";
import { ChangePasswordForm } from "@/components/employee/profile/change-password-form";
import { PinSettings } from "@/components/employee/profile/pin-settings";
import { ShieldCheck, KeyRound, UserCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Profile",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function EmployeeProfilePage() {
  const user = await requireUser();
  const service = await EmployeePortalService.create();
  const profileService = await ProfileService.create();
  const [employee, hasPin] = await Promise.all([
    service.getEmployee(),
    profileService.hasWithdrawalPin(),
  ]);

  if (!employee) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">No employee profile linked</p>
          <p className="text-sm text-muted-foreground">
            Ask your HR or organization admin to link your account to an
            employee record so you can use the portal.
          </p>
        </CardContent>
      </Card>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile & Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your photo, password and withdrawal security
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle2 className="size-4 text-primary" />
              Photo
            </CardTitle>
            <CardDescription>Your profile picture</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <AvatarUpload
              url={avatarUrl}
              name={`${employee.first_name} ${employee.last_name}`}
              email={employee.email}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>Update the password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              Withdrawal PIN
            </CardTitle>
            <CardDescription>
              A 4-digit PIN required to authorize withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PinSettings hasPin={hasPin} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment Details</CardTitle>
            <CardDescription>Your employment information</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Employee Number</dt>
                <dd className="font-medium">{employee.employee_number}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{employee.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium">{employee.department ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Branch</dt>
                <dd className="font-medium">{employee.branch ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Job Title</dt>
                <dd className="font-medium">{employee.job_title ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Employment Type</dt>
                <dd className="font-medium">{employee.employment_type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Employment Status</dt>
                <dd className="font-medium">{employee.employment_status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Monthly Salary</dt>
                <dd className="font-medium text-primary">{naira(Number(employee.salary))}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}