import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, findResource, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function POST(_request: NextRequest, context: { params: Promise<{ resourceId: string }> }) {
  const session = await getSession();

  const { resourceId } = await context.params;
  let restored = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "restore_from_bin"))) {
      forbidden = true;
      return hubData;
    }

    const found = findResource(hubData, resourceId);
    if (!found) return hubData;

    delete found.resource.deletedAt;
    delete found.resource.deletedBy;
    restored = true;
    addAuditLog(hubData, {
      action: "Resource restored",
      detail: `${found.resource.title} in ${found.category.name}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!restored) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
