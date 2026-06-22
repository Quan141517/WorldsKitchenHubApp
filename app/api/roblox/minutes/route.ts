import { NextRequest, NextResponse } from "next/server";
import { updateHubData } from "@/lib/hub-store";
import type { ActivityMinuteEntry } from "@/lib/mock-data";

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.ROBLOX_TRACKER_SECRET;
  if (!expectedSecret) return false;

  const providedSecret = request.headers.get("x-roblox-tracker-secret");
  return providedSecret === expectedSecret;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    trackerConfigured: Boolean(process.env.ROBLOX_TRACKER_SECRET),
    placeId: process.env.ROBLOX_PLACE_ID || null,
    universeId: process.env.ROBLOX_UNIVERSE_ID || null,
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized tracker request" }, { status: 401 });
  }

  const body = (await request.json()) as {
    robloxUserId?: string | number;
    robloxUsername?: string;
    minutes?: number;
    recordedAt?: string;
    placeId?: string | number;
    universeId?: string | number;
  };

  const robloxUserId = String(body.robloxUserId || "").trim();
  const robloxUsername = String(body.robloxUsername || "").trim();
  const placeId = String(body.placeId || process.env.ROBLOX_PLACE_ID || "").trim();
  const universeId = String(body.universeId || process.env.ROBLOX_UNIVERSE_ID || "").trim();
  const minutes = Math.max(0, Math.min(720, Math.round(Number(body.minutes || 0))));

  if (!robloxUserId || !robloxUsername || !minutes) {
    return NextResponse.json({ error: "Missing robloxUserId, robloxUsername, or minutes" }, { status: 400 });
  }

  if (process.env.ROBLOX_PLACE_ID && placeId !== process.env.ROBLOX_PLACE_ID) {
    return NextResponse.json({ error: "Unexpected Roblox place" }, { status: 403 });
  }

  if (process.env.ROBLOX_UNIVERSE_ID && universeId !== process.env.ROBLOX_UNIVERSE_ID) {
    return NextResponse.json({ error: "Unexpected Roblox universe" }, { status: 403 });
  }

  const entry: ActivityMinuteEntry = {
    id: `minute-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    robloxUserId,
    robloxUsername,
    minutes,
    placeId,
    universeId,
    recordedAt: body.recordedAt || new Date().toISOString(),
  };

  await updateHubData((hubData) => {
    hubData.activityMinuteEntries.unshift(entry);
    hubData.activityMinuteEntries = hubData.activityMinuteEntries.slice(0, 20000);

    return hubData;
  });

  return NextResponse.json({ ok: true, entry });
}
