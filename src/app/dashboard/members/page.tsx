import type { Metadata } from "next";
import Link from "next/link";
import { MemberService } from "@/services/member-service";
import { getProfile } from "@/lib/auth";
import { SettingsService } from "@/services/settings-service";
import { AddMemberDialog } from "@/components/dashboard/members/add-member-dialog";
import { InviteLinkButton } from "@/components/dashboard/invite-link-button";
import { MemberApprovalActions } from "@/components/dashboard/members/member-approval-actions";
import { EditMemberDialog } from "@/components/dashboard/members/edit-member-dialog";
import { NinVerification } from "@/components/nin/nin-verification";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleTableBody } from "@/components/ui/collapsible-table-body";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownToLine, HandCoins, Users } from "lucide-react";
import { NameSearch } from "@/components/dashboard/name-search";

export const metadata: Metadata = {
  title: "Members",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const service = await MemberService.createForStaff();
  const profile = await getProfile();
  const settingsService = await SettingsService.create();
  const [members, settings] = await Promise.all([
    service.listMembers(),
    settingsService.getSettings(),
  ]);

  const term = (q ?? "").trim().toLowerCase();
  const filteredMembers = term
    ? members.filter((member) =>
        `${member.first_name ?? ""} ${member.last_name ?? ""} ${
          member.member_number ?? ""
        } ${member.email ?? ""}`
          .toLowerCase()
          .includes(term)
      )
    : members;

  const pendingApprovals = members.filter(
    (member) => member.status !== "ACTIVE"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">External Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Non-employees who save with your organization and borrow against
            their savings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={<Link href="/dashboard/members/loans" />}
          >
            <HandCoins className="size-4" />
            Member Loans
          </Button>
          <Button
            variant="outline"
            render={<Link href="/dashboard/members/withdrawals" />}
          >
            <ArrowDownToLine className="size-4" />
            Withdrawals
          </Button>
          {profile?.organization_id ? (
            <InviteLinkButton
              organizationId={profile.organization_id}
              kind="member"
              enabled={settings?.member_registration_enabled ?? true}
            />
          ) : null}
          <AddMemberDialog />
        </div>
      </div>

      <div className="flex justify-end">
        <NameSearch placeholder="Search member name, number or email…" />
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
            <CardDescription>Active members</CardDescription>
            <CardTitle className="text-2xl">
              {members.filter((member) => member.status === "ACTIVE").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting approval</CardDescription>
            <CardTitle className="text-2xl">{pendingApprovals}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {term ? "No matching members" : "No external members yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {term
                ? "No member matches that name, number or email."
                : "Add a member to let them start saving towards a loan."}
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
            <CollapsibleTableBody columns={7} itemLabel="members">
              {filteredMembers.map((member) => (
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
                      <Badge
                        variant={member.status === "ACTIVE" ? "default" : "secondary"}
                      >
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
            </CollapsibleTableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
