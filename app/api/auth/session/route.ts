import { NextResponse } from "next/server";
import { upsertStaffProfile } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (session?.robloxUserId) await upsertStaffProfile(session);
  return NextResponse.json({ session });
}
