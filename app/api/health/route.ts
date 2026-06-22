import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  const checks = {
    robloxClientId: Boolean(process.env.ROBLOX_CLIENT_ID),
    robloxClientSecret: Boolean(process.env.ROBLOX_CLIENT_SECRET),
    robloxRedirectUri: Boolean(process.env.ROBLOX_REDIRECT_URI),
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    supabase: isSupabaseConfigured(),
    robloxGroupId: Boolean(process.env.ROBLOX_GROUP_ID),
    robloxPlaceId: Boolean(process.env.ROBLOX_PLACE_ID),
    robloxUniverseId: Boolean(process.env.ROBLOX_UNIVERSE_ID),
    robloxTrackerSecret: Boolean(process.env.ROBLOX_TRACKER_SECRET),
  };
  const labels: Record<keyof typeof checks, string> = {
    robloxClientId: "ROBLOX_CLIENT_ID",
    robloxClientSecret: "ROBLOX_CLIENT_SECRET",
    robloxRedirectUri: "ROBLOX_REDIRECT_URI",
    sessionSecret: "SESSION_SECRET",
    supabase: "Supabase URL and service role key",
    robloxGroupId: "ROBLOX_GROUP_ID",
    robloxPlaceId: "ROBLOX_PLACE_ID",
    robloxUniverseId: "ROBLOX_UNIVERSE_ID",
    robloxTrackerSecret: "ROBLOX_TRACKER_SECRET",
  };
  const missing = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([key]) => labels[key as keyof typeof checks]);

  return NextResponse.json({
    ok: missing.length === 0,
    launchReady: missing.length === 0,
    missing,
    checks,
  });
}
