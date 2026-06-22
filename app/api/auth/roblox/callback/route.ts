import { NextRequest, NextResponse } from "next/server";
import { buildSessionFromRoblox, exchangeRobloxCode, getRobloxUserInfo } from "@/lib/roblox-auth";
import { upsertStaffProfile } from "@/lib/hub-store";
import { setSessionCookie } from "@/lib/session";

const stateCookieName = "wk_roblox_oauth_state";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(stateCookieName)?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/?auth=missing-code", request.url));
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth=invalid-state", request.url));
  }

  try {
    const token = await exchangeRobloxCode(code);
    const user = await getRobloxUserInfo(token.access_token);
    const session = await buildSessionFromRoblox(user);

    await upsertStaffProfile(session);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(stateCookieName);
    setSessionCookie(response, session);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?auth=roblox-error", request.url));
  }
}
