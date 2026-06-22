import { NextRequest, NextResponse } from "next/server";
import { readHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

type RobloxGroupUser = {
  user?: {
    userId?: number;
    username?: string;
    displayName?: string;
  };
  role?: {
    id?: number;
    name?: string;
    rank?: number;
  };
};

type RobloxGroupUsersResponse = {
  data?: RobloxGroupUser[];
  nextPageCursor?: string | null;
};

async function getRobloxAvatarUrls(userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();

  const thumbnailResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds.join(",")}&size=100x100&format=Png&isCircular=false`);
  if (!thumbnailResponse.ok) return new Map<string, string>();

  const thumbnailPayload = (await thumbnailResponse.json()) as {
    data?: Array<{
      targetId: number;
      imageUrl?: string;
    }>;
  };

  return new Map((thumbnailPayload.data || []).filter((item) => item.imageUrl).map((item) => [String(item.targetId), item.imageUrl!]));
}

function matchesQuery(value: string | undefined, query: string) {
  return !query || Boolean(value && value.toLowerCase().includes(query));
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

  const hubData = await readHubData();
  const localUsers = hubData.profiles
    .filter((profile) => matchesQuery(profile.robloxUsername, query) || matchesQuery(profile.discordUsername, query))
    .map((profile) => ({
      userId: profile.robloxUserId || "",
      username: profile.robloxUsername || profile.discordUsername,
      displayName: profile.robloxDisplayName || profile.robloxUsername || profile.discordUsername,
      avatarUrl: profile.robloxAvatarUrl || profile.avatarUrl,
      source: "connected",
    }));

  const groupId = process.env.ROBLOX_GROUP_ID;
  if (!groupId) {
    return NextResponse.json({ users: localUsers.slice(0, 12), needsGroupId: true });
  }

  try {
    const groupMembers: RobloxGroupUser[] = [];
    let cursor = "";

    for (let page = 0; page < 20; page += 1) {
      const groupResponse = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/users?limit=100&sortOrder=Asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (!groupResponse.ok) return NextResponse.json({ users: localUsers.slice(0, 12), needsGroupId: false });

      const groupPayload = (await groupResponse.json()) as RobloxGroupUsersResponse;
      groupMembers.push(...(groupPayload.data || []));
      if (query && groupMembers.filter((item) => item.user?.username && (matchesQuery(item.user.username, query) || matchesQuery(item.user.displayName, query))).length >= 18) break;
      if (!groupPayload.nextPageCursor) break;
      cursor = groupPayload.nextPageCursor;
    }

    const matchedGroupUsers = groupMembers
      .filter((item) => item.user?.username && (matchesQuery(item.user.username, query) || matchesQuery(item.user.displayName, query)))
      .map((item) => ({
        userId: String(item.user!.userId || ""),
        username: item.user!.username || "",
        displayName: item.user!.displayName || item.user!.username || "",
        roleName: item.role?.name || "",
        roleRank: item.role?.rank || 0,
        source: "group",
      }));
    const avatarUrls = await getRobloxAvatarUrls(matchedGroupUsers.map((user) => user.userId).filter(Boolean));
    const groupUsers = matchedGroupUsers.map((user) => ({
      ...user,
      avatarUrl: localUsers.find((localUser) => localUser.userId === user.userId)?.avatarUrl || avatarUrls.get(user.userId) || null,
    }));

    return NextResponse.json({ users: groupUsers.slice(0, 18), needsGroupId: false });
  } catch {
    return NextResponse.json({ users: localUsers.slice(0, 12), needsGroupId: false });
  }
}
