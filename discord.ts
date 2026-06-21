import { getHighestRole } from "./roles";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
};

type DiscordUser = {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordGuildMember = {
  roles: string[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDiscordAuthorizeUrl() {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", getRequiredEnv("DISCORD_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getRequiredEnv("DISCORD_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds.members.read");
  return url;
}

export async function exchangeDiscordCode(code: string) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("DISCORD_CLIENT_ID"),
    client_secret: getRequiredEnv("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRequiredEnv("DISCORD_REDIRECT_URI"),
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status}`);
  }

  return (await response.json()) as DiscordTokenResponse;
}

export async function getDiscordUser(accessToken: string) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Discord user lookup failed: ${response.status}`);
  }

  return (await response.json()) as DiscordUser;
}

export async function getDiscordGuildMember(accessToken: string) {
  const guildId = getRequiredEnv("DISCORD_GUILD_ID");
  const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Discord guild member lookup failed: ${response.status}`);
  }

  return (await response.json()) as DiscordGuildMember;
}

export function getDiscordAvatarUrl(user: DiscordUser) {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export function getDisplayName(user: DiscordUser) {
  return user.global_name || user.username;
}

export function buildSessionFromDiscord(user: DiscordUser, member: DiscordGuildMember | null) {
  const discordRoleIds = member?.roles || [];

  return {
    discordUserId: user.id,
    username: getDisplayName(user),
    avatarUrl: getDiscordAvatarUrl(user),
    role: getHighestRole(discordRoleIds, user.id) || null,
    discordRoleIds,
  };
}
