import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listReportMetas } from "@/services/report-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileChartColumn,
  FileText,
  HandCoins,
  Landmark,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Wallet,
  ArrowDownToLine,
  Users,
  PiggyBank,
  Percent,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Reports",
};

const reportIcons: Record<string, LucideIcon> = {
  employee: Users,
  thrift: PiggyBank,
  "thrift-interest": Percent,
  "loan-applications": FileText,
  "loan-portfolio": HandCoins,
  repayments: RefreshCw,
  default: Landmark,
  fund: Wallet,
  "interest-income": TrendingUp,
  withdrawal: ArrowDownToLine,
  transaction: FileChartColumn,
  audit: ShieldCheck,
};

export default async function ReportsPage() {
  await requireUser();
  const reports = listReportMetas();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate and export business reports
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = reportIcons[report.key] ?? BarChart3;
          return (
            <Link key={report.key} href={`/dashboard/reports/${report.key}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" />
        Reports are scoped to your organization only.
      </div>
    </div>
  );
}