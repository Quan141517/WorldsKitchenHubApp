import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRobloxGroupMembership } from "./roblox";
import { getStaffRoleFromRobloxRank } from "./roles";
import type { StaffRole } from "./roles";

export type DiscordSession = {
  provider?: "discord" | "roblox";
  discordUserId: string;
  username: string;
  avatarUrl: string | null;
  role: StaffRole | null;
  discordRoleIds: string[];
  robloxUserId?: string;
  robloxUsername?: string;
  robloxDisplayName?: string;
  robloxAvatarUrl?: string | null;
  robloxRoleName?: string;
  robloxRoleRank?: number;
};

const sessionCookieName = "wk_session";

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

function getSessionSecret() {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be configured in production.");
  }

  return process.env.SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET || "worlds-kitchen-local-session-secret";
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function encodeSession(session: DiscordSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function decodeSession(value: string | undefined): DiscordSession | null {
  if (!value) return null;

  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;

    const expectedSignature = signPayload(payload);
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedSignatureBuffer.length || !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
      return null;
    }

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DiscordSession;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(sessionCookieName)?.value);
  if (!session?.robloxUserId) return session;

  try {
    const membership = await getRobloxGroupMembership(session.robloxUserId);
    return {
      ...session,
      role: getStaffRoleFromRobloxRank(membership?.roleRank),
      robloxRoleName: membership?.roleName,
      robloxRoleRank: membership?.roleRank,
    };
  } catch {
    return session;
  }
}

export async function setSession(session: DiscordSession) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, encodeSession(session), getSessionCookieOptions());
}

export function setSessionCookie(response: NextResponse, session: DiscordSession) {
  response.cookies.set(sessionCookieName, encodeSession(session), getSessionCookieOptions());
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(sessionCookieName);
}
