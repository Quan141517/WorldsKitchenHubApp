import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

function canManage(roleId?: string) {
  return roleId === "owner";
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ grantId: string }> }) {
  const session = await getSession();

  if (!canManage(session?.role?.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { grantId } = await context.params;
  let revoked = false;
  const data = await updateHubData((hubData) => {
    const grant = hubData.adminGrants.find((item) => item.id === grantId);
    if (!grant) return hubData;

    grant.revokedAt = new Date().toISOString();
    grant.revokedBy = session?.username || "Unknown";
    revoked = true;
    addAuditLog(hubData, {
      action: "Admin grant revoked",
      detail: grant.discordUserId,
      actor: session?.username || "Unknown",
      type: "admins",
    });
    return hubData;
  });

  if (!revoked) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
