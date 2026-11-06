import type { Metadata } from "next";
import Link from "next/link";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "Under maintenance | SalaryFlow",
};

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <SalaryFlowLogo size="md" animated />
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Wrench className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">We&apos;ll be right back</h1>
          <p className="text-sm text-muted-foreground">
            SalaryFlow is under scheduled maintenance. The platform will be
            available again shortly.
          </p>
          <p className="text-xs text-muted-foreground">
            If this is urgent, contact your organization administrator.
          </p>
          <Button variant="outline" className="mt-2" render={<Link href="/auth/login" />}>
            Platform owner sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
