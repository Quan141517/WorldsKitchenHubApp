import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, createSlug, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { Announcement } from "@/lib/mock-data";
import type { StaffRoleId } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const session = await getSession();

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

  const announcement: Announcement = {
    id: `${createSlug(body.title)}-${Date.now()}`,
    title: body.title.trim(),
    content: body.content.trim(),
    status: body.status || "draft",
    accentColor: body.accentColor || undefined,
    allowedRoleIds: Array.from(new Set([...(body.allowedRoleIds || []), "owner"])),
    createdBy: session?.username || "Unknown",
    createdById: session?.discordUserId,
  };

  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "create_announcements"))) {
      forbidden = true;
      return hubData;
    }

    hubData.announcements.unshift(announcement);
    addAuditLog(hubData, {
      action: "Announcement created",
      detail: announcement.title,
      actor: session?.username || "Unknown",
      type: "announcements",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session), announcement });
}
