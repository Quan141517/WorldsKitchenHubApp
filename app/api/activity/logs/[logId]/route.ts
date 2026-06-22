import { NextRequest, NextResponse } from "next/server";
import { sanitizeShiftRoles, sanitizeTrainingRoles } from "@/lib/activity-roles";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { ShiftRoles, TrainingRoles } from "@/lib/mock-data";

function canModifyLog(roleLevel: number | undefined, hasManagePermission: boolean, sessionUserId: string | undefined, loggerUserId: string) {
  return Boolean((roleLevel && roleLevel >= 100) || hasManagePermission || (sessionUserId && sessionUserId === loggerUserId));
}

function canDeleteLog(roleLevel: number | undefined, hasManagePermission: boolean, sessionUserId: string | undefined, loggerUserId: string) {
  return Boolean((roleLevel && roleLevel >= 100) || hasManagePermission || (sessionUserId && sessionUserId === loggerUserId));
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ logId: string }> }) {
  const session = await getSession();
  const { logId } = await context.params;
  const body = (await request.json()) as {
    roles?: TrainingRoles | ShiftRoles;
    notes?: string;
    creditedMinutes?: number;
  };

  let updated = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    const log = hubData.activityLogs.find((item) => item.id === logId);
    if (!log) return hubData;
    if (!canModifyLog(session?.role?.level, hasAdminPermission(hubData, session?.discordUserId, "manage_activity_logs"), session?.discordUserId, log.loggerDiscordUserId)) {
      forbidden = true;
      return hubData;
    }

    if (body.roles) {
      const loggerUsername = log.loggerUsername || session?.username || "Unknown";
      log.roles = log.type === "training"
        ? sanitizeTrainingRoles(body.roles as Partial<TrainingRoles>, loggerUsername)
        : sanitizeShiftRoles(body.roles as Partial<ShiftRoles>, loggerUsername);
    }
    log.notes = body.notes ?? log.notes;
    log.creditedMinutes = log.type === "training" ? 0 : Math.max(0, Number(body.creditedMinutes ?? log.creditedMinutes ?? 0));
    log.updatedAt = new Date().toISOString();
    updated = true;
    addAuditLog(hubData, {
      action: "Activity log updated",
      detail: `${log.dateLabel} ${log.time} Server ${log.serverNumber}`,
      actor: session?.username || "Unknown",
      type: "activity",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!updated) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ logId: string }> }) {
  const session = await getSession();
  const { logId } = await context.params;

  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    const log = hubData.activityLogs.find((item) => item.id === logId);
    if (!log) return hubData;
    if (!canDeleteLog(session?.role?.level, hasAdminPermission(hubData, session?.discordUserId, "manage_activity_logs"), session?.discordUserId, log.loggerDiscordUserId)) {
      forbidden = true;
      return hubData;
    }

    log.deletedAt = new Date().toISOString();
    log.deletedBy = session?.username || "Unknown";
    moved = true;
    addAuditLog(hubData, {
      action: "Activity log moved to bin",
      detail: `${log.dateLabel} ${log.time} Server ${log.serverNumber}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!moved) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
