import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, updateHubData } from "@/lib/hub-store";
import { getRobloxGroupMembership, isValidRobloxUsername, resolveRobloxProfile } from "@/lib/roblox";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    robloxUsername?: string;
    robloxUserId?: string;
  };

  const robloxUsername = body.robloxUsername?.trim();
  if (!robloxUsername || !isValidRobloxUsername(robloxUsername)) {
    return NextResponse.json({ error: "Invalid Roblox username" }, { status: 400 });
  }

  let robloxProfile;
  try {
    robloxProfile = await resolveRobloxProfile(robloxUsername);
  } catch {
    return NextResponse.json({ error: "Roblox could not be reached right now." }, { status: 502 });
  }

  if (!robloxProfile) {
    return NextResponse.json({ error: "Roblox username not found." }, { status: 404 });
  }

  let groupMembership = null;
  if (process.env.ROBLOX_GROUP_ID) {
    try {
      groupMembership = await getRobloxGroupMembership(robloxProfile.userId);
    } catch {
      return NextResponse.json({ error: "Roblox group could not be checked right now." }, { status: 502 });
    }

    if (!groupMembership) {
      return NextResponse.json({ error: "This Roblox account is not in the World's Kitchen group." }, { status: 403 });
    }
  }

  let updated = false;
  let conflict = false;
  const data = await updateHubData((hubData) => {
    const now = new Date().toISOString();
    const profileOwner = hubData.profiles.find((item) =>
      item.discordUserId !== session.discordUserId &&
      (item.robloxUserId === robloxProfile.userId || item.robloxUsername?.toLowerCase() === robloxProfile.username.toLowerCase())
    );
    if (profileOwner) {
      conflict = true;
      return hubData;
    }

    let profile = hubData.profiles.find((item) => item.discordUserId === session.discordUserId);

    if (!profile) {
      profile = {
        discordUserId: session.discordUserId,
        discordUsername: session.username,
        avatarUrl: session.avatarUrl,
        highestRoleId: session.role?.id || null,
        discordRoleIds: session.discordRoleIds,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
      };
      hubData.profiles.push(profile);
    }

    profile.robloxUserId = robloxProfile.userId;
    profile.robloxUsername = robloxProfile.username;
    profile.robloxDisplayName = robloxProfile.displayName;
    profile.robloxAvatarUrl = robloxProfile.avatarUrl;
    profile.robloxRoleName = groupMembership?.roleName;
    profile.robloxRoleRank = groupMembership?.roleRank;
    profile.updatedAt = now;
    addAuditLog(hubData, {
      action: "Roblox profile linked",
      detail: `${robloxProfile.username} (${robloxProfile.userId})`,
      actor: session.username,
      type: "admins",
    });
    updated = true;
    return hubData;
  });

  if (conflict) {
    return NextResponse.json({ error: "This Roblox username is already linked to another Discord account." }, { status: 409 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
