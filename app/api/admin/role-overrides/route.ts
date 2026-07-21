import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, updateHubData } from "@/lib/hub-store";
import { staffRoles, type StaffRoleId } from "@/lib/roles";
import { getSession } from "@/lib/session";

export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (session?.role?.id !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    userId?: string;
    roleId?: StaffRoleId;
    note?: string;
  };

  const userId = body.userId?.trim();
  const role = staffRoles.find((staffRole) => staffRole.id === body.roleId);

  if (!userId || !role || role.id === "owner") {
    return NextResponse.json({ error: "Invalid role override" }, { status: 400 });
  }

  const data = await updateHubData((hubData) => {
    const now = new Date().toISOString();
    const existing = hubData.roleOverrides.find((override) => override.userId === userId);
    const nextOverride = {
      id: existing?.id || `role-override-${Date.now()}`,
      userId,
      roleId: role.id,
      note: body.note?.trim() || "",
      createdAt: existing?.createdAt || now,
      createdBy: session.username,
      updatedAt: now,
    };

    if (existing) {
      Object.assign(existing, nextOverride);
    } else {
      hubData.roleOverrides.push(nextOverride);
    }

    addAuditLog(hubData, {
      action: "Testing role override saved",
      detail: `${userId}: ${role.name}`,
      actor: session.username,
      type: "admins",
    });

    return hubData;
  });

  return NextResponse.json({ data });
}
