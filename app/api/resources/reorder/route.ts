import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function POST(request: NextRequest) {
  const session = await getSession();
  const body = (await request.json()) as {
    categoryId?: string;
    sourceResourceId?: string;
    targetResourceId?: string;
  };

  if (!body.categoryId || !body.sourceResourceId || !body.targetResourceId || body.sourceResourceId === body.targetResourceId) {
    return NextResponse.json({ error: "Missing reorder information" }, { status: 400 });
  }

  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "edit_resources"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === body.categoryId);
    if (!category) return hubData;

    const sourceIndex = category.resources.findIndex((resource) => resource.id === body.sourceResourceId && !resource.deletedAt);
    const targetIndex = category.resources.findIndex((resource) => resource.id === body.targetResourceId && !resource.deletedAt);
    if (sourceIndex < 0 || targetIndex < 0) return hubData;

    const sourceResource = category.resources[sourceIndex];
    category.resources[sourceIndex] = category.resources[targetIndex];
    category.resources[targetIndex] = sourceResource;
    moved = true;
    addAuditLog(hubData, {
      action: "Resource reordered",
      detail: `${sourceResource.title} moved in ${category.name}`,
      actor: session?.username || "Unknown",
      type: "documents",
    });
    return hubData;
  });

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!moved) return NextResponse.json({ error: "Resource could not be moved" }, { status: 400 });

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
