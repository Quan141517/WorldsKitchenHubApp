import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();

  const body = (await request.json()) as {
    categoryId?: string;
    direction?: "up" | "down";
  };

  if (!body.categoryId || !body.direction) {
    return NextResponse.json({ error: "Missing reorder information" }, { status: 400 });
  }

  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "manage_categories"))) {
      forbidden = true;
      return hubData;
    }

    const index = hubData.categories.findIndex((category) => category.id === body.categoryId);
    const targetIndex = body.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= hubData.categories.length) return hubData;

    const [category] = hubData.categories.splice(index, 1);
    hubData.categories.splice(targetIndex, 0, category);
    moved = true;
    addAuditLog(hubData, {
      action: "Category reordered",
      detail: `${category.name} moved ${body.direction}`,
      actor: session?.username || "Unknown",
      type: "categories",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!moved) {
    return NextResponse.json({ error: "Category could not be moved" }, { status: 400 });
  }

  return NextResponse.json({ data });
}
