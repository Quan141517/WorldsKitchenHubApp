import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, createSlug, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { adminPermissions, type AdminLevel, type AdminPermission } from "@/lib/mock-data";

function canManage(discordUserId?: string, roleId?: string) {
  return Boolean(discordUserId && roleId === "owner");
}

export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!canManage(session?.discordUserId, session?.role?.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    adminLevels?: Array<Partial<AdminLevel> & { name: string; permissions: AdminPermission[] }>;
  };

  if (!body.adminLevels?.length) {
    return NextResponse.json({ error: "Missing admin levels" }, { status: 400 });
  }

  const validPermissions = new Set<AdminPermission>(adminPermissions);
  const nextLevels: AdminLevel[] = body.adminLevels.map((level) => ({
    id: level.id || `${createSlug(level.name)}-${Date.now()}`,
    name: level.name.trim(),
    permissions: Array.from(new Set(level.permissions || [])).filter((permission) => validPermissions.has(permission)),
  }));

  const data = await updateHubData((hubData) => {
    hubData.adminLevels = nextLevels;
    addAuditLog(hubData, {
      action: "Admin levels updated",
      detail: `${nextLevels.length} levels saved`,
      actor: session?.username || "Unknown",
      type: "admins",
    });
    return hubData;
  });

  return NextResponse.json({ data });
}
