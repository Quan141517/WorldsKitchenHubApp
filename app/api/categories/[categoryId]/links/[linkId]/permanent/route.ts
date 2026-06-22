import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ categoryId: string; linkId: string }> }) {
  const session = await getSession();

  const { categoryId, linkId } = await context.params;
  let deleted = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "delete_permanently"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === categoryId);
    if (!category?.links) return hubData;

    const index = category.links.findIndex((link) => link.id === linkId);
    if (index === -1) return hubData;

    const [removed] = category.links.splice(index, 1);
    deleted = true;
    addAuditLog(hubData, {
      action: "Category link permanently deleted",
      detail: `${removed.label} from ${category.name}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!deleted) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
