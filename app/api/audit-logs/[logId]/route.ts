import { NextResponse } from "next/server";
import { updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

export async function DELETE(_request: Request, context: { params: Promise<{ logId: string }> }) {
  const session = await getSession();
  const { logId } = await context.params;

  if (session?.role?.id !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let removed = false;
  const data = await updateHubData((hubData) => {
    const nextLogs = hubData.auditLogs.filter((log) => log.id !== logId);
    removed = nextLogs.length !== hubData.auditLogs.length;
    hubData.auditLogs = nextLogs;
    return hubData;
  });

  if (!removed) return NextResponse.json({ error: "Log not found" }, { status: 404 });
  return NextResponse.json({ data });
}
