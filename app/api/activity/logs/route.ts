import { NextRequest, NextResponse } from "next/server";
import { sanitizeShiftRoles, sanitizeTrainingRoles } from "@/lib/activity-roles";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { ActivityLog, ShiftRoles, TrainingRoles } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  const session = await getSession();

  const body = (await request.json()) as {
    type?: "training" | "shift";
    dateLabel?: string;
    time?: string;
    roles?: TrainingRoles | ShiftRoles;
    notes?: string;
    creditedMinutes?: number;
  };

  if (!body.type || !body.dateLabel || !body.time || !body.roles) {
    return NextResponse.json({ error: "Missing log information" }, { status: 400 });
  }

  let serverNumber = 1;
  let activityLog: ActivityLog | null = null;
  let missingHost = false;

  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_activity_logs"))) {
      forbidden = true;
      return hubData;
    }

    const profile = hubData.profiles.find((item) => item.discordUserId === session?.discordUserId);
    const loggerUsername = profile?.robloxUsername || session?.username || "Unknown";
    const roles = body.type === "training"
      ? sanitizeTrainingRoles(body.roles as Partial<TrainingRoles>, loggerUsername)
      : sanitizeShiftRoles(body.roles as Partial<ShiftRoles>, loggerUsername);

    if (!roles.host) {
      missingHost = true;
      return hubData;
    }

    const newActivityLog: ActivityLog = {
      id: `activity-log-${Date.now()}`,
      type: body.type!,
      dateLabel: body.dateLabel!,
      time: body.time!,
      serverNumber,
      loggerDiscordUserId: session?.discordUserId || "unknown",
      loggerUsername,
      roles,
      notes: body.notes?.trim() || "",
      creditedMinutes: body.type === "training" ? 0 : Math.max(0, Number(body.creditedMinutes || 0)),
      createdAt: new Date().toISOString(),
    };

    const existingServers = hubData.activityLogs.filter((log) => !log.deletedAt && log.type === newActivityLog.type && log.dateLabel === newActivityLog.dateLabel && log.time === newActivityLog.time);
    serverNumber = existingServers.length + 1;
    newActivityLog.serverNumber = serverNumber;
    hubData.activityLogs.push(newActivityLog);
    activityLog = newActivityLog;
    addAuditLog(hubData, {
      action: `${newActivityLog.type === "training" ? "Training" : "Shift"} log created`,
      detail: `${newActivityLog.dateLabel} ${newActivityLog.time} Server ${newActivityLog.serverNumber}`,
      actor: session?.username || "Unknown",
      type: "activity",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (missingHost || !activityLog) {
    return NextResponse.json({ error: "Missing host username" }, { status: 400 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session), activityLog });
}
