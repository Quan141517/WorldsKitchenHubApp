import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ resourceId: string }> }) {
  const session = await getSession();

  const { resourceId } = await context.params;
  let deleted = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "delete_permanently"))) {
      forbidden = true;
      return hubData;
    }

    for (const category of hubData.categories) {
      const index = category.resources.findIndex((resource) => resource.id === resourceId);
      if (index === -1) continue;

      const [removed] = category.resources.splice(index, 1);
      deleted = true;
      addAuditLog(hubData, {
        action: "Resource permanently deleted",
        detail: `${removed.title} from ${category.name}`,
        actor: session?.username || "Unknown",
        type: "bin",
      });
      break;
    }
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!deleted) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
