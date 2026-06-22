import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, findResource, getResourceExcerpt, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";
import type { Resource } from "@/lib/mock-data";

export async function PATCH(request: NextRequest, context: { params: Promise<{ resourceId: string }> }) {
  const session = await getSession();

  const { resourceId } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    status?: Resource["status"];
    contentHtml?: string;
    accentColor?: string;
  };

  let updatedResource: Resource | null = null;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "edit_resources"))) {
      forbidden = true;
      return hubData;
    }

    const found = findResource(hubData, resourceId);
    if (!found) return hubData;

    found.resource.title = body.title?.trim() || found.resource.title;
    found.resource.status = body.status || found.resource.status;
    found.resource.accentColor = body.accentColor || undefined;
    found.resource.contentHtml = body.contentHtml ?? found.resource.contentHtml;
    found.resource.excerpt = getResourceExcerpt(found.resource.contentHtml);
    updatedResource = found.resource;
    addAuditLog(hubData, {
      action: "Resource edited",
      detail: `${found.resource.title} in ${found.category.name}`,
      actor: session?.username || "Unknown",
      type: "documents",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!updatedResource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session), resource: updatedResource });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ resourceId: string }> }) {
  const session = await getSession();

  const { resourceId } = await context.params;
  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "move_resources_to_bin"))) {
      forbidden = true;
      return hubData;
    }

    const found = findResource(hubData, resourceId);
    if (!found) return hubData;

    found.resource.deletedAt = new Date().toISOString();
    found.resource.deletedBy = session?.username || "Unknown";
    moved = true;
    addAuditLog(hubData, {
      action: "Resource moved to bin",
      detail: `${found.resource.title} from ${found.category.name}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!moved) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
