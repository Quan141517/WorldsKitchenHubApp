import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, createSlug, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import type { QuickLink } from "@/lib/mock-data";

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  const body = (await request.json()) as {
    label?: string;
    url?: string;
  };

  if (!body.label?.trim() || !body.url?.trim()) {
    return NextResponse.json({ error: "Missing link label or URL" }, { status: 400 });
  }

  if (!isValidHttpUrl(body.url.trim())) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const link: QuickLink = {
    id: `${createSlug(body.label)}-${Date.now()}`,
    label: body.label.trim(),
    url: body.url.trim(),
  };

  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_home_links"))) {
      forbidden = true;
      return hubData;
    }

    hubData.quickLinks.push(link);
    addAuditLog(hubData, {
      action: "Quick link created",
      detail: link.label,
      actor: session?.username || "Unknown",
      type: "links",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data, link });
}
