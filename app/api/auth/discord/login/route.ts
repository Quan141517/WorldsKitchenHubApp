import { NextResponse } from "next/server";
import { getDiscordAuthorizeUrl } from "@/lib/discord";

export function GET() {
  return NextResponse.redirect(getDiscordAuthorizeUrl());
}
