import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ categoryId: string; linkId: string }> }) {
  const session = await getSession();

  const { categoryId, linkId } = await context.params;
  let moved = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!((session?.role?.level && session.role.level >= 100) || hasAdminPermission(hubData, session?.discordUserId, "manage_category_links"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === categoryId);
    const link = category?.links?.find((item) => item.id === linkId);
    if (!category || !link) return hubData;

    link.deletedAt = new Date().toISOString();
    link.deletedBy = session?.username || "Unknown";
    moved = true;
    addAuditLog(hubData, {
      action: "Category link moved to bin",
      detail: `${link.label} from ${category.name}`,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!moved) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
