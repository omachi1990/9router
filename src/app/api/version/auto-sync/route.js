import { NextResponse } from "next/server";
import fs from "fs";
import { spawn } from "child_process";

const STATUS_FILE = "/root/.9router/upstream_sync_status.json";
const SCRIPT_PATH = "/root/9router/scripts/auto-sync-upstream.sh";

export async function GET() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const content = fs.readFileSync(STATUS_FILE, "utf8");
      return NextResponse.json(JSON.parse(content));
    }
    return NextResponse.json({
      status: "unknown",
      message: "No sync record found yet.",
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error?.message || "Failed to read sync status",
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!fs.existsSync(SCRIPT_PATH)) {
      return NextResponse.json({
        success: false,
        message: "Auto-sync script not found.",
      }, { status: 404 });
    }

    // Spawn script in background
    const child = spawn("bash", [SCRIPT_PATH], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({
      success: true,
      message: "Upstream auto-sync triggered in background.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error?.message || "Failed to trigger auto-sync",
    }, { status: 500 });
  }
}
