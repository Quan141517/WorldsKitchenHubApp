import { getStaffRoleFromRobloxRank } from "./roles";
import { getRobloxGroupMembership } from "./roblox";
import type { DiscordSession } from "./session";

type RobloxTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

type RobloxUserInfo = {
  sub: string;
  name?: string;
  nickname?: string;
  preferred_username?: string;
  picture?: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getRobloxAuthorizeUrl(state: string) {
  const url = new URL("https://apis.roblox.com/oauth/v1/authorize");
  url.searchParams.set("client_id", getRequiredEnv("ROBLOX_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getRequiredEnv("ROBLOX_REDIRECT_URI"));
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeRobloxCode(code: string) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("ROBLOX_CLIENT_ID"),
    client_secret: getRequiredEnv("ROBLOX_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
  });

  const response = await fetch("https://apis.roblox.com/oauth/v1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Roblox token exchange failed: ${response.status}`);
  }

  return (await response.json()) as RobloxTokenResponse;
}

export async function getRobloxUserInfo(accessToken: string) {
  const response = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Roblox userinfo lookup failed: ${response.status}`);
  }

  return (await response.json()) as RobloxUserInfo;
}

export async function buildSessionFromRoblox(user: RobloxUserInfo): Promise<DiscordSession> {
  const membership = await getRobloxGroupMembership(user.sub);
  const username = user.preferred_username || user.nickname || user.name || `Roblox ${user.sub}`;
  const displayName = user.name || user.nickname || username;

  return {
    provider: "roblox",
    discordUserId: `roblox:${user.sub}`,
    username,
    avatarUrl: user.picture || null,
    role: getStaffRoleFromRobloxRank(membership?.roleRank),
    discordRoleIds: [],
    robloxUserId: user.sub,
    robloxUsername: username,
    robloxDisplayName: displayName,
    robloxAvatarUrl: user.picture || null,
    robloxRoleName: membership?.roleName,
    robloxRoleRank: membership?.roleRank,
  };
}
