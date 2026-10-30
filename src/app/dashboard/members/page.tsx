import type { Metadata } from "next";
import { MemberService } from "@/services/member-service";
import { getProfile } from "@/lib/auth";
import { AddMemberDialog } from "@/components/dashboard/members/add-member-dialog";
import { InviteLinkButton } from "@/components/dashboard/invite-link-button";
import { MemberApprovalActions } from "@/components/dashboard/members/member-approval-actions";
import { EditMemberDialog } from "@/components/dashboard/members/edit-member-dialog";
import { MemberLoanActions } from "@/components/dashboard/members/member-loan-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import { NinVerification } from "@/components/nin/nin-verification";

export const metadata: Metadata = {
  title: "Members",
};

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function MembersPage() {
  const service = await MemberService.createForStaff();
  const profile = await getProfile();
  const [members, applications] = await Promise.all([
    service.listMembers(),
    service.listMemberApplications(),
  ]);

  const pending = applications.filter((application) => application.status === "PENDING");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">External Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Non-employees who save with your organization and borrow against their
            savings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile?.organization_id ? (
            <InviteLinkButton
              organizationId={profile.organization_id}
              kind="member"
            />
          ) : null}
          <AddMemberDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-2xl">{members.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending loan requests</CardDescription>
            <CardTitle className="text-2xl">{pending.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active members</CardDescription>
            <CardTitle className="text-2xl">
              {members.filter((member) => member.status === "ACTIVE").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan requests</CardTitle>
            <CardDescription>
              Approving a request credits the loan into the member&apos;s savings
              wallet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Repayment</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {pending.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <p className="font-medium">{application.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.memberNumber}
                          {application.joinedAt
                            ? ` · joined ${new Date(application.joinedAt).toLocaleDateString("en-NG")}`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono">
                        {naira(Number(application.amount))}
                      </TableCell>
                      <TableCell className="font-mono">
                        {naira(Number(application.total_repayment))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {application.submitted_at
                          ? new Date(application.submitted_at).toLocaleDateString("en-NG")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberLoanActions applicationId={application.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No external members yet</p>
            <p className="text-sm text-muted-foreground">
              Add a member to let them start saving towards a loan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>NIN</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.first_name} {member.last_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {member.member_number}
                  </TableCell>
                  <TableCell className="text-sm">{member.email}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(member.joined_at).toLocaleDateString("en-NG")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>
                        {member.status}
                      </Badge>
                      {member.status === "PENDING" ? (
                        <MemberApprovalActions memberId={member.id} />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <NinVerification
                      kind="member"
                      id={member.id}
                      nin={member.nin}
                      documentUrl={member.nin_document_url}
                      status={member.nin_status}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditMemberDialog member={member} />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
