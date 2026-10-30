import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";

export const metadata: Metadata = {
  title: "Login",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <h1>
          <SalaryFlowLogo size="md" animated />
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to your account
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Welcome back</CardTitle>
          <CardDescription>
            {params.reset === "success"
              ? "Password reset successful. Sign in with your new password."
              : "Enter your credentials to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t have an account? Contact your organization administrator.
      </p>
    </div>
  );
}
