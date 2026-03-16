import { NextResponse } from "next/server";

import { loadPmDueItems, loadRecentPmLogs } from "@/lib/pm-data";

export async function GET() {
  try {
    const [items, recentLogs] = await Promise.all([loadPmDueItems(), loadRecentPmLogs()]);

    return NextResponse.json({ items, recentLogs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load PM tracker" },
      { status: 400 }
    );
  }
}
