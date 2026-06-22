import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ linkId: string }> }) {
  const session = await getSession();

  const { linkId } = await context.params;
  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_home_links"))) {
      forbidden = true;
      return hubData;
    }

    const link = hubData.quickLinks.find((item) => item.id === linkId);
    if (!link) return hubData;

    link.deletedAt = new Date().toISOString();
    link.deletedBy = session?.username || "Unknown";
    moved = true;
    addAuditLog(hubData, {
      action: "Quick link moved to bin",
      detail: link.label,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!moved) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
