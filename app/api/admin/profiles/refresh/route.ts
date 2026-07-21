import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, readHubData, updateHubData } from "@/lib/hub-store";
import { getRobloxGroupMembership } from "@/lib/roblox";
import { getStaffRoleFromRobloxRank } from "@/lib/roles";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (session?.role?.id !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string };
  const userId = body.userId?.trim().toLowerCase();

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
  }

  const currentData = await readHubData();
  const currentProfile = currentData.profiles.find((item) =>
    item.discordUserId.toLowerCase() === userId ||
    item.robloxUserId?.toLowerCase() === userId ||
    item.robloxUsername?.toLowerCase() === userId ||
    item.robloxDisplayName?.toLowerCase() === userId
  );

  if (!currentProfile?.robloxUserId) {
    return NextResponse.json({ error: "Profile not found or missing Roblox ID" }, { status: 404 });
  }

  const membership = await getRobloxGroupMembership(currentProfile.robloxUserId);
  const role = getStaffRoleFromRobloxRank(membership?.roleRank);
  const data = await updateHubData((hubData) => {
    const profile = hubData.profiles.find((item) => item.discordUserId === currentProfile.discordUserId);
    if (!profile) return hubData;
    profile.highestRoleId = role?.id || null;
    profile.robloxRoleName = membership?.roleName;
    profile.robloxRoleRank = membership?.roleRank;
    profile.updatedAt = new Date().toISOString();

    addAuditLog(hubData, {
      action: "Connected profile rank refreshed",
      detail: `${profile.robloxUsername || profile.discordUsername}: ${role?.name || "No matching Roblox group role"}`,
      actor: session.username,
      type: "admins",
    });

    return hubData;
  });

  return NextResponse.json({ data });
}
