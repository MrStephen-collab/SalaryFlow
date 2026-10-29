import Link from "next/link";
import { SalaryFlowLogo } from "@/components/brand/salaryflow-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Banknote,
  FileCheck2,
  LineChart,
  Lock,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const employerFeatures = [
  {
    icon: Banknote,
    title: "Structured Employee Loans",
    description:
      "Create loan products and policies to give employees structured financial support with complete control.",
  },
  {
    icon: FileCheck2,
    title: "Salary Deduction Engine",
    description:
      "Automatically calculate loan deductions from salary with configurable limits and reconciliation.",
  },
  {
    icon: Lock,
    title: "Secure & Multi-Tenant",
    description:
      "Every organization's data is isolated with row-level security and granular role-based access.",
  },
];

const employeeFeatures = [
  {
    icon: Wallet,
    title: "Check Your Balance",
    description:
      "See your salary, available balance, and every deduction from one simple dashboard.",
  },
  {
    icon: Banknote,
    title: "Apply for Loans",
    description:
      "See what you qualify for, apply instantly, and track your repayment schedule in real time.",
  },
  {
    icon: LineChart,
    title: "Track Repayments",
    description:
      "Understand every payment, download statements, and monitor your progress toward full repayment.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SalaryFlow home">
            <SalaryFlowLogo layout="horizontal" size="sm" label={null} />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              href="#for-employers"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              For Employers
            </Link>
            <Link
              href="#for-employees"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              For Employees
            </Link>
            <Link
              href="#security"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Security
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" render={<Link href="/auth/login" />}>
              Sign in
            </Button>
            <Button render={<Link href="/auth/register" />}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <section className="py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Give Your Employees Easier Access to{" "}
            <span className="text-primary">Salary-Backed Finance</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Manage employee loans, salary deductions, repayments and financial
            accounts from one simple platform.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" render={<Link href="/auth/register" />}>
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              Book a Demo
            </Button>
          </div>
        </section>

        <section id="for-employers" className="py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              For Employers
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Give employees structured financial support while maintaining
              complete control over loan policies and salary deductions.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {employerFeatures.map((feature) => (
              <Card key={feature.title} className="border-none shadow-sm">
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="for-employees" className="py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              For Employees
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              See what you qualify for, apply for a loan, track repayments and
              understand every deduction from your salary.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {employeeFeatures.map((feature) => (
              <Card key={feature.title} className="border-none shadow-sm">
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="security"
          className="flex flex-col items-center gap-6 py-16 text-center"
        >
          <Card className="w-full max-w-2xl border-none bg-muted/50 shadow-sm">
            <CardHeader>
              <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
              <CardTitle className="text-2xl">
                Built for financial integrity
              </CardTitle>
              <CardDescription className="text-base">
                Immutable ledger entries, double-entry accounting, multi-tenant
                row-level security, and audit logging across every financial
                transaction.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Set up your organization and give your employees easier access to
            salary-backed finance.
          </p>
          <Button size="lg" className="mt-8" render={<Link href="/auth/register" />}>
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SalaryFlow. All rights reserved.
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
