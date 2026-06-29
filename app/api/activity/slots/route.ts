import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { ActivitySlots } from "@/lib/mock-data";

function cleanSlots(values: unknown) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value).trim())
    .filter((value) => /^\d{1,2}:\d{2}\s(?:AM|PM)\sEST$/i.test(value))
    .slice(0, 12);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  const body = (await request.json()) as Partial<ActivitySlots>;

  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_assignments") || hasAdminPermission(hubData, session?.discordUserId, "manage_activity_slots"))) {
      forbidden = true;
      return hubData;
    }

    hubData.activitySlots = {
      trainings: cleanSlots(body.trainings),
      shifts: cleanSlots(body.shifts),
    };

    addAuditLog(hubData, {
      action: "Activity slots updated",
      detail: `${hubData.activitySlots.trainings.length} trainings, ${hubData.activitySlots.shifts.length} shifts`,
      actor: session?.username || "Unknown",
      type: "activity",
    });

    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
