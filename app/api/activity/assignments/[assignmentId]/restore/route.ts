import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function POST(_request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const session = await getSession();

  const { assignmentId } = await context.params;
  let restored = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "restore_from_bin"))) {
      forbidden = true;
      return hubData;
    }

    const assignment = hubData.weeklyAssignments.find((item) => item.id === assignmentId);
    if (!assignment) return hubData;

    delete assignment.deletedAt;
    delete assignment.deletedBy;
    restored = true;
    addAuditLog(hubData, {
      action: "Weekly assignment restored",
      detail: assignment.teamRoleId,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!restored) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
