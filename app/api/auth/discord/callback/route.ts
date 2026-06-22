import { NextRequest, NextResponse } from "next/server";
import { buildSessionFromDiscord, exchangeDiscordCode, getDiscordGuildMember, getDiscordUser } from "@/lib/discord";
import { upsertStaffProfile } from "@/lib/hub-store";
import { setSessionCookie } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?auth=missing-code", request.url));
  }

  try {
    const token = await exchangeDiscordCode(code);
    const user = await getDiscordUser(token.access_token);
    const member = await getDiscordGuildMember(token.access_token);
    const session = buildSessionFromDiscord(user, member);

    await upsertStaffProfile(session);
    const response = NextResponse.redirect(new URL("/", request.url));
    setSessionCookie(response, session);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?auth=discord-error", request.url));
  }
}
