import type { Metadata } from "next";
import { requireUser, getProfile } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarUpload } from "@/components/employee/profile/avatar-upload";
import { ChangePasswordForm } from "@/components/employee/profile/change-password-form";
import { KeyRound, UserCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function DashboardProfilePage() {
  const user = await requireUser();
  const profile = await getProfile();

  const name = user.user_metadata?.full_name ?? user.email ?? "User";
  const avatarUrl = user.user_metadata?.avatar_url ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your photo, account details and password
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
            <AvatarUpload url={avatarUrl} name={name} email={user.email} />
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
            <CardDescription>Your identity on this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{user.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium">{profile?.role ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs break-all">{user.id}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
