import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, createSlug, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { QuickLink } from "@/lib/mock-data";

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  const session = await getSession();

  const { categoryId } = await context.params;
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

  let created = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "manage_category_links"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === categoryId);
    if (!category) return hubData;

    category.links ||= [];
    category.links.push(link);
    created = true;
    addAuditLog(hubData, {
      action: "Category link created",
      detail: `${link.label} in ${category.name}`,
      actor: session?.username || "Unknown",
      type: "links",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!created) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session), link });
}
