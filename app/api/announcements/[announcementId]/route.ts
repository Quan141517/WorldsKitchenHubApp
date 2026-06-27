import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { Announcement } from "@/lib/mock-data";
import type { StaffRoleId } from "@/lib/roles";

export async function PATCH(request: NextRequest, context: { params: Promise<{ announcementId: string }> }) {
  const session = await getSession();
  const { announcementId } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    content?: string;
    status?: Announcement["status"];
    accentColor?: string;
    allowedRoleIds?: StaffRoleId[];
  };

  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: "Missing announcement content" }, { status: 400 });
  }
  const title = body.title.trim();
  const content = body.content.trim();

  let updatedAnnouncement: Announcement | null = null;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    const announcement = hubData.announcements.find((item) => item.id === announcementId);
    if (!announcement || announcement.deletedAt) return hubData;

    const canEdit =
      (session?.role?.level && session.role.level >= 100) ||
      hasAdminPermission(hubData, session?.discordUserId, "create_announcements") ||
      Boolean(announcement.createdById && announcement.createdById === session?.discordUserId);

    if (!canEdit) {
      forbidden = true;
      return hubData;
    }

    announcement.title = title;
    announcement.content = content;
    announcement.status = body.status || "draft";
    announcement.accentColor = body.accentColor || undefined;
    announcement.allowedRoleIds = Array.from(new Set([...(body.allowedRoleIds || []), "owner"]));
    updatedAnnouncement = announcement;

    addAuditLog(hubData, {
      action: "Announcement updated",
      detail: announcement.title,
      actor: session?.username || "Unknown",
      type: "announcements",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!updatedAnnouncement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });

  return NextResponse.json({ data: filterHubDataForSession(data, session), announcement: updatedAnnouncement });
}

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
