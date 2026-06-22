import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getRobloxAuthorizeUrl } from "@/lib/roblox-auth";

const stateCookieName = "wk_roblox_oauth_state";

export function GET() {
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(getRobloxAuthorizeUrl(state));
  response.cookies.set(stateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
