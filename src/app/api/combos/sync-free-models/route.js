import { NextResponse } from "next/server";
import { syncAndTestFreeModels, getLatestFreeModelsSyncStatus } from "@/shared/services/opencodeFreeSync";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getLatestFreeModelsSyncStatus();
  return NextResponse.json(status);
}

export async function POST(request) {
  try {
    let probe = true;
    try {
      const body = await request.json();
      if (typeof body?.probe === "boolean") {
        probe = body.probe;
      }
    } catch {}

    const result = await syncAndTestFreeModels({ probe });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
