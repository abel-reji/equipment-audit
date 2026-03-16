import { NextResponse } from "next/server";

import { loadPmAssetDetail } from "@/lib/pm-data";

export async function GET(
  _: Request,
  { params }: { params: { assetId: string } }
) {
  try {
    const detail = await loadPmAssetDetail(params.assetId);
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load PM asset detail" },
      { status: 400 }
    );
  }
}
