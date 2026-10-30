import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MemberService } from "@/services/member-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Profile",
};

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "PENDING":
      return "secondary" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function MemberProfilePage() {
  const user = await requireUser();
  const service = await MemberService.createForStaff();
  const member = await service.getMyMember();

  if (!member) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">No member profile found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact your organization for help.
          </p>
        </CardContent>
      </Card>
    );
  }

  const initials = `${member.first_name} ${member.last_name}`
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const memberId = member.id;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your member account details
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="size-4 text-primary" />
            Member Account
          </CardTitle>
          <CardDescription>
            Your membership with {member.organizationName ?? "your organization"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" alt={`${member.first_name} ${member.last_name}`} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <Badge variant={statusVariant(member.status)}>
              {member.status === "ACTIVE" ? "Active" : member.status}
            </Badge>
          </div>
          <div className="grid flex-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Full Name</dt>
              <dd className="font-medium">
                {member.first_name} {member.last_name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member Number</dt>
              <dd className="font-mono font-medium">{member.member_number}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{member.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{member.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">NIN</dt>
              <dd className="font-mono font-medium">{member.nin ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">NIN Status</dt>
              <dd className="font-medium capitalize">{member.nin_status ?? "pending"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date Joined</dt>
              <dd className="font-medium">
                {member.joined_at
                  ? new Date(member.joined_at).toLocaleDateString("en-NG")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Organization</dt>
              <dd className="font-medium">{member.organizationName ?? "—"}</dd>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings</CardTitle>
          <CardDescription>Your savings wallet summary</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberSavingsSummary memberId={memberId} />
        </CardContent>
      </Card>
    </div>
  );
}

async function MemberSavingsSummary({ memberId }: { memberId: string }) {
  const service = await MemberService.createForStaff();
  const summary = await service.getSummaryForMember(memberId);
  if (!summary) {
    return <p className="text-sm text-muted-foreground">No savings data yet.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <p className="text-sm text-muted-foreground">My Savings</p>
        <p className="text-lg font-semibold text-primary">
          {new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 2,
          }).format(summary.savingsBalance)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Wallet Balance</p>
        <p className="text-lg font-semibold">
          {new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 2,
          }).format(summary.walletBalance)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Total Deposited</p>
        <p className="text-lg font-semibold text-green-600">
          {new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 2,
          }).format(summary.totalDeposited)}
        </p>
      </div>
    </div>
  );
}
