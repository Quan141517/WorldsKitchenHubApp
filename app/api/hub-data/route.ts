import { NextResponse } from "next/server";
import { refreshAchievementBadges } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function GET() {
  const session = await getSession();
  return NextResponse.json(filterHubDataForSession(await refreshAchievementBadges(), session));
}
