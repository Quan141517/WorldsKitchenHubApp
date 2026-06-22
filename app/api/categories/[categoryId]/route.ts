import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import type { StaffRoleId } from "@/lib/roles";

export async function PATCH(request: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  const session = await getSession();

  const { categoryId } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    allowedRoleIds?: StaffRoleId[];
  };

  let updated = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_categories"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === categoryId);
    if (!category) return hubData;

    category.name = body.name?.trim() || category.name;
    category.allowedRoleIds = Array.from(new Set([...(body.allowedRoleIds || category.allowedRoleIds), "owner"]));
    updated = true;
    addAuditLog(hubData, {
      action: "Category updated",
      detail: category.name,
      actor: session?.username || "Unknown",
      type: "categories",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  const session = await getSession();

  const { categoryId } = await context.params;
  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_categories"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === categoryId);
    if (!category) return hubData;

    category.deletedAt = new Date().toISOString();
    category.deletedBy = session?.username || "Unknown";
    moved = true;
    addAuditLog(hubData, {
      action: "Category moved to bin",
      detail: category.name,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!moved) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
