import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ logId: string }> }) {
  const session = await getSession();

  const { logId } = await context.params;
  let deleted = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "delete_permanently"))) {
      forbidden = true;
      return hubData;
    }

    const index = hubData.activityLogs.findIndex((log) => log.id === logId);
    if (index === -1) return hubData;

    const [removed] = hubData.activityLogs.splice(index, 1);
    deleted = true;
    addAuditLog(hubData, {
      action: "Activity log permanently deleted",
      detail: `${removed.dateLabel} ${removed.time} Server ${removed.serverNumber}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!deleted) return NextResponse.json({ error: "Log not found" }, { status: 404 });
  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
