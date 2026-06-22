import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, createSlug, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import type { StaffRoleId } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const session = await getSession();

  const body = (await request.json()) as {
    name?: string;
    allowedRoleIds?: StaffRoleId[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Missing category name" }, { status: 400 });
  }

  const id = `${createSlug(body.name)}-${Date.now()}`;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_categories"))) {
      forbidden = true;
      return hubData;
    }

    hubData.categories.push({
      id,
      name: body.name!.trim(),
      allowedRoleIds: Array.from(new Set([...(body.allowedRoleIds || []), "owner"])),
      resources: [],
    });
    addAuditLog(hubData, {
      action: "Category created",
      detail: body.name!.trim(),
      actor: session?.username || "Unknown",
      type: "categories",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data, categoryId: id });
}
