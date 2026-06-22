export type RobloxProfile = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type RobloxGroupMembership = {
  roleName: string;
  roleRank: number;
};

export function isValidRobloxUsername(username: string) {
  return /^[A-Za-z0-9_]{3,20}$/.test(username);
}

export async function resolveRobloxProfile(username: string): Promise<RobloxProfile | null> {
  const cleanUsername = username.trim();
  if (!isValidRobloxUsername(cleanUsername)) return null;

  const userResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      usernames: [cleanUsername],
      excludeBannedUsers: true,
    }),
  });

  if (!userResponse.ok) {
    throw new Error("Roblox username lookup failed.");
  }

  const userPayload = (await userResponse.json()) as {
    data?: Array<{
      id: number;
      name: string;
      displayName: string;
    }>;
  };

  const user = userPayload.data?.[0];
  if (!user) return null;

  const thumbnailResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=100x100&format=Png&isCircular=false`);
  let avatarUrl: string | null = null;

  if (thumbnailResponse.ok) {
    const thumbnailPayload = (await thumbnailResponse.json()) as {
      data?: Array<{
        targetId: number;
        imageUrl?: string;
      }>;
    };
    avatarUrl = thumbnailPayload.data?.find((item) => item.targetId === user.id)?.imageUrl || null;
  }

  return {
    userId: String(user.id),
    username: user.name,
    displayName: user.displayName,
    avatarUrl,
  };
}

export async function getRobloxGroupMembership(userId: string): Promise<RobloxGroupMembership | null> {
  const groupId = process.env.ROBLOX_GROUP_ID;
  if (!groupId || !userId) return null;

  let cursor = "";
  for (let page = 0; page < 50; page += 1) {
    const groupResponse = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/users?limit=100&sortOrder=Asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!groupResponse.ok) {
      throw new Error("Roblox group membership lookup failed.");
    }

    const groupPayload = (await groupResponse.json()) as {
      data?: Array<{
        user?: {
          userId?: number;
        };
        role?: {
          name?: string;
          rank?: number;
        };
      }>;
      nextPageCursor?: string | null;
    };

    const match = groupPayload.data?.find((item) => String(item.user?.userId || "") === userId);
    if (match) {
      return {
        roleName: match.role?.name || "Group Member",
        roleRank: match.role?.rank || 0,
      };
    }

    if (!groupPayload.nextPageCursor) break;
    cursor = groupPayload.nextPageCursor;
  }

  return null;
}
