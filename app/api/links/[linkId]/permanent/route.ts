import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ linkId: string }> }) {
  const session = await getSession();

  const { linkId } = await context.params;
  let deleted = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "delete_permanently"))) {
      forbidden = true;
      return hubData;
    }

    const index = hubData.quickLinks.findIndex((link) => link.id === linkId);
    if (index === -1) return hubData;

    const [removed] = hubData.quickLinks.splice(index, 1);
    deleted = true;
    addAuditLog(hubData, {
      action: "Quick link permanently deleted",
      detail: removed.label,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!deleted) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
