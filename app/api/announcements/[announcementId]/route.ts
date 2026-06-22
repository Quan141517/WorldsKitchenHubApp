import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ announcementId: string }> }) {
  const session = await getSession();
  const { announcementId } = await context.params;

  let deleted = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "delete_announcements"))) {
      forbidden = true;
      return hubData;
    }

    const announcement = hubData.announcements.find((item) => item.id === announcementId);
    if (!announcement) return hubData;

    announcement.deletedAt = new Date().toISOString();
    announcement.deletedBy = session?.username || "Unknown";
    deleted = true;
    addAuditLog(hubData, {
      action: "Announcement deleted",
      detail: announcement.title,
      actor: session?.username || "Unknown",
      type: "announcements",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!deleted) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
