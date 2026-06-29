import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, updateHubData } from "@/lib/hub-store";
import { adminPermissions, type AdminPermission } from "@/lib/mock-data";
import { staffRoles, type StaffRoleId } from "@/lib/roles";
import { getSession } from "@/lib/session";

export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (session?.role?.id !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    roleId?: StaffRoleId;
    permissions?: AdminPermission[];
  };

  const role = staffRoles.find((staffRole) => staffRole.id === body.roleId);
  if (!role || role.id === "owner") {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  const validPermissions = new Set<AdminPermission>(adminPermissions);
  const permissions = Array.from(new Set(body.permissions || [])).filter((permission) => validPermissions.has(permission));

  const data = await updateHubData((hubData) => {
    const existing = hubData.teamPermissions.find((grant) => grant.roleId === role.id);
    const nextGrant = {
      roleId: role.id,
      permissions,
      updatedAt: new Date().toISOString(),
      updatedBy: session.username,
    };

    if (existing) {
      Object.assign(existing, nextGrant);
    } else {
      hubData.teamPermissions.push(nextGrant);
    }

    addAuditLog(hubData, {
      action: "Team permissions updated",
      detail: `${role.name}: ${permissions.length} permissions enabled`,
      actor: session.username,
      type: "admins",
    });

    return hubData;
  });

  return NextResponse.json({ data });
}
