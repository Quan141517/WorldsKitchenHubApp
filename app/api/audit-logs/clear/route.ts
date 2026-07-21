import { NextRequest, NextResponse } from "next/server";
import { updateHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (session?.role?.id !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { logIds?: string[] };
  const logIds = new Set(body.logIds || []);

  const data = await updateHubData((hubData) => {
    hubData.auditLogs = logIds.size
      ? hubData.auditLogs.filter((log) => !logIds.has(log.id))
      : [];
    return hubData;
  });

  return NextResponse.json({ data });
}
