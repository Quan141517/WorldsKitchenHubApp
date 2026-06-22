import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, createResource, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { Resource } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  const session = await getSession();

  const body = (await request.json()) as {
    categoryId?: string;
    title?: string;
    status?: Resource["status"];
    contentHtml?: string;
    accentColor?: string;
  };

  if (!body.categoryId || !body.title?.trim()) {
    return NextResponse.json({ error: "Missing category or title" }, { status: 400 });
  }

  let createdResource: Resource | null = null;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "create_resources"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === body.categoryId);
    if (!category) return hubData;

    createdResource = createResource(body.title!.trim(), body.status || "draft", body.contentHtml || "", body.accentColor || undefined);
    category.resources.push(createdResource);
    addAuditLog(hubData, {
      action: "Resource created",
      detail: `${createdResource.title} in ${category.name}`,
      actor: session?.username || "Unknown",
      type: "documents",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!createdResource) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session), resource: createdResource });
}
