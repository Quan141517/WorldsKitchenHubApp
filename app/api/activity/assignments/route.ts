import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { StaffRoleId } from "@/lib/roles";
import type { WeeklyAssignment } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  const session = await getSession();

  const body = (await request.json()) as {
    teamRoleId?: StaffRoleId;
    sessions?: number;
    minutes?: number;
    shifts?: number;
    effectiveFrom?: string;
  };

  if (!body.teamRoleId) {
    return NextResponse.json({ error: "Missing team" }, { status: 400 });
  }

  const assignment: WeeklyAssignment = {
    id: `assignment-${body.teamRoleId}-${Date.now()}`,
    teamRoleId: body.teamRoleId,
    sessions: Math.max(0, Number(body.sessions || 0)),
    minutes: Math.max(0, Number(body.minutes || 0)),
    shifts: Math.max(0, Number(body.shifts || 0)),
    effectiveFrom: body.effectiveFrom || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    createdBy: session?.username || "Unknown",
  };

  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "manage_assignments"))) {
      forbidden = true;
      return hubData;
    }

    hubData.weeklyAssignments.unshift(assignment);
    addAuditLog(hubData, {
      action: "Weekly assignment created",
      detail: `${assignment.teamRoleId}: ${assignment.sessions} sessions, ${assignment.minutes} minutes, ${assignment.shifts} shifts`,
      actor: session?.username || "Unknown",
      type: "activity",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session), assignment });
}
