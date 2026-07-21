import { NextResponse } from "next/server";
import { addAuditLog, updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

export async function DELETE(_request: Request, context: { params: Promise<{ overrideId: string }> }) {
  const session = await getSession();
  const { overrideId } = await context.params;

  if (session?.role?.id !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let removed = false;
  const data = await updateHubData((hubData) => {
    const override = hubData.roleOverrides.find((item) => item.id === overrideId);
    if (!override) return hubData;

    hubData.roleOverrides = hubData.roleOverrides.filter((item) => item.id !== overrideId);
    removed = true;
    addAuditLog(hubData, {
      action: "Testing role override removed",
      detail: `${override.userId}: ${override.roleId}`,
      actor: session.username,
      type: "admins",
    });
    return hubData;
  });

  if (!removed) return NextResponse.json({ error: "Override not found" }, { status: 404 });
  return NextResponse.json({ data });
}
