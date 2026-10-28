import type { Metadata } from "next";
import { SuperAdminService } from "@/services/super-admin-service";
import { requireSuperAdmin } from "@/lib/auth";
import { PlansTable } from "@/components/super-admin/plans-table";

export const metadata: Metadata = {
  title: "Plans | SalaryFlow Admin",
};

export default async function PlansPage() {
  await requireSuperAdmin();

  const service = new SuperAdminService();
  const plans = await service.listPlans();

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage platform subscription plans
        </p>
      </div>

      <PlansTable plans={plans} />
    </>
  );
}