import { NextRequest, NextResponse } from "next/server";
import { addAuditLog, hasAdminPermission, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export async function POST(_request: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  const session = await getSession();

  const { categoryId } = await context.params;
  let restored = false;
  let forbidden = false;
  const data = await updateHubData((hubData) => {
    if (!(session?.role?.id === "owner" || hasAdminPermission(hubData, session?.discordUserId, "restore_from_bin"))) {
      forbidden = true;
      return hubData;
    }

    const category = hubData.categories.find((item) => item.id === categoryId);
    if (!category) return hubData;

    delete category.deletedAt;
    delete category.deletedBy;
    restored = true;
    addAuditLog(hubData, {
      action: "Category restored",
      detail: category.name,
      actor: session?.username || "Unknown",
      type: "bin",
    });
    return hubData;
  });

  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!restored) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data: filterHubDataForSession(data, session) });
}
