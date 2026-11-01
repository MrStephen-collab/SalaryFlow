import type { Metadata } from "next";
import { AnnouncementService } from "@/services/announcement-service";
import { AnnouncementManager } from "@/components/dashboard/announcements/announcement-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Announcements",
};

export default async function AnnouncementsPage() {
  const service = await AnnouncementService.create();
  const announcements = await service.listAll();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active messages scroll across the top of the member and employee
          portals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal announcements</CardTitle>
          <CardDescription>
            Use them to encourage on-time loan repayment, savings habits or any
            important notice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementManager announcements={announcements} />
        </CardContent>
      </Card>
    </div>
  );
}
