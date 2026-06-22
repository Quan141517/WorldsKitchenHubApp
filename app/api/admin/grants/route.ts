import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import type { AdminGrant } from "@/lib/mock-data";

function canManage(roleId?: string) {
  return roleId === "owner";
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!canManage(session?.role?.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    discordUserId?: string;
    adminLevelId?: string;
  };

  if (!body.discordUserId?.trim() || !body.adminLevelId) {
    return NextResponse.json({ error: "Missing admin grant information" }, { status: 400 });
  }

  const grant: AdminGrant = {
    id: `admin-grant-${Date.now()}`,
    discordUserId: body.discordUserId.trim(),
    adminLevelId: body.adminLevelId,
    grantedBy: session?.username || "Unknown",
    createdAt: new Date().toISOString(),
  };

  const data = await updateHubData((hubData) => {
    const level = hubData.adminLevels.find((item) => item.id === body.adminLevelId);
    if (!level) return hubData;

    const existing = hubData.adminGrants.find((item) => item.discordUserId === grant.discordUserId && item.adminLevelId === grant.adminLevelId && !item.revokedAt);
    if (!existing) hubData.adminGrants.push(grant);

    addAuditLog(hubData, {
      action: "Admin grant added",
      detail: `${grant.discordUserId} -> ${level.name}`,
      actor: session?.username || "Unknown",
      type: "admins",
    });
    return hubData;
  });

  return NextResponse.json({ data });
}
