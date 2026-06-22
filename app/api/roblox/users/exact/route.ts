import { NextRequest, NextResponse } from "next/server";
import { readHubData } from "@/lib/hub-store";
import { getRobloxGroupMembership, resolveRobloxProfile } from "@/lib/roblox";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = request.nextUrl.searchParams.get("username")?.trim() || "";
  if (!username) return NextResponse.json({ user: null });

  const hubData = await readHubData();
  const knownProfile = hubData.profiles.find((profile) =>
    [profile.robloxUsername, profile.robloxDisplayName, profile.discordUsername]
      .filter(Boolean)
      .some((value) => value!.toLowerCase() === username.toLowerCase())
  );

  const profile = knownProfile?.robloxUserId
    ? {
        userId: knownProfile.robloxUserId,
        username: knownProfile.robloxUsername || knownProfile.discordUsername,
        displayName: knownProfile.robloxDisplayName || knownProfile.robloxUsername || knownProfile.discordUsername,
        avatarUrl: knownProfile.robloxAvatarUrl || knownProfile.avatarUrl || null,
      }
    : await resolveRobloxProfile(username);

  if (!profile) return NextResponse.json({ user: null });

  const membership = await getRobloxGroupMembership(profile.userId);
  if (!membership) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      ...profile,
      roleName: membership.roleName,
      roleRank: membership.roleRank,
      source: "group",
    },
  });
}
