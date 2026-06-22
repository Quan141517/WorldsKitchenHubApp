import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function POST(_request: NextRequest, context: { params: Promise<{ logId: string }> }) {
  const session = await getSession();

  const { logId } = await context.params;
  let restored = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "restore_from_bin"))) {
      forbidden = true;
      return hubData;
    }

    const log = hubData.activityLogs.find((item) => item.id === logId);
    if (!log) return hubData;

    delete log.deletedAt;
    delete log.deletedBy;
    restored = true;
    addAuditLog(hubData, {
      action: "Activity log restored",
      detail: `${log.dateLabel} ${log.time} Server ${log.serverNumber}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!restored) return NextResponse.json({ error: "Log not found" }, { status: 404 });
  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
