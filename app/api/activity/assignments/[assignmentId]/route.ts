import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { StaffRoleId } from "@/lib/roles";

export async function PATCH(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const session = await getSession();

  const { assignmentId } = await context.params;
  const body = (await request.json()) as {
    teamRoleId?: StaffRoleId;
    sessions?: number;
    minutes?: number;
    shifts?: number;
    effectiveFrom?: string;
  };

  let updated = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "manage_assignments"))) {
      forbidden = true;
      return hubData;
    }

    const assignment = hubData.weeklyAssignments.find((item) => item.id === assignmentId);
    if (!assignment) return hubData;

    assignment.teamRoleId = body.teamRoleId || assignment.teamRoleId;
    assignment.sessions = Math.max(0, Number(body.sessions ?? assignment.sessions));
    assignment.minutes = Math.max(0, Number(body.minutes ?? assignment.minutes));
    assignment.shifts = Math.max(0, Number(body.shifts ?? assignment.shifts));
    assignment.effectiveFrom = body.effectiveFrom || assignment.effectiveFrom;
    updated = true;
    addAuditLog(hubData, {
      action: "Weekly assignment updated",
      detail: assignment.teamRoleId,
      actor: session?.username || "Unknown",
      type: "activity",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const session = await getSession();

  const { assignmentId } = await context.params;
  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "manage_assignments"))) {
      forbidden = true;
      return hubData;
    }

    const assignment = hubData.weeklyAssignments.find((item) => item.id === assignmentId);
    if (!assignment) return hubData;

    assignment.deletedAt = new Date().toISOString();
    assignment.deletedBy = session?.username || "Unknown";
    moved = true;
    addAuditLog(hubData, {
      action: "Weekly assignment moved to bin",
      detail: assignment.teamRoleId,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!moved) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
