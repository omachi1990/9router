import { getAdapter } from "@/lib/db/driver.js";

export async function getOpenCodeGoUsage(connectionId) {
  if (!connectionId) {
    return {
      plan: "OpenCode Go ($10/mo)",
      message: "OpenCode Go includes $12 usage limits per 5h, $30 per week, and $60 per month. Check your console at opencode.ai/auth.",
      quotas: {},
    };
  }

  try {
    const db = await getAdapter();
    const nowMs = Date.now();

    // Query 5-hour cost
    const limit5h = nowMs - 5 * 60 * 60 * 1000;
    const row5h = db.get(
      "SELECT COALESCE(SUM(cost), 0) as totalCost FROM usageHistory WHERE connectionId = ? AND timestamp >= ? AND status = 'ok'",
      [connectionId, new Date(limit5h).toISOString()]
    );
    const cost5h = row5h?.totalCost || 0;

    // Query 7-day cost
    const limit7d = nowMs - 7 * 24 * 60 * 60 * 1000;
    const row7d = db.get(
      "SELECT COALESCE(SUM(cost), 0) as totalCost FROM usageHistory WHERE connectionId = ? AND timestamp >= ? AND status = 'ok'",
      [connectionId, new Date(limit7d).toISOString()]
    );
    const cost7d = row7d?.totalCost || 0;

    // Query 30-day cost
    const limit30d = nowMs - 30 * 24 * 60 * 60 * 1000;
    const row30d = db.get(
      "SELECT COALESCE(SUM(cost), 0) as totalCost FROM usageHistory WHERE connectionId = ? AND timestamp >= ? AND status = 'ok'",
      [connectionId, new Date(limit30d).toISOString()]
    );
    const cost30d = row30d?.totalCost || 0;

    return {
      plan: "OpenCode Go ($10/mo)",
      message: "Estimated usage based on requests routed through 9router. View official billing details at opencode.ai/auth.",
      quotas: {
        "5-Hour Window ($12)": {
          used: Number(cost5h.toFixed(4)),
          total: 12,
          remaining: Number(Math.max(0, 12 - cost5h).toFixed(4)),
          unlimited: false,
        },
        "Weekly Window ($30)": {
          used: Number(cost7d.toFixed(4)),
          total: 30,
          remaining: Number(Math.max(0, 30 - cost7d).toFixed(4)),
          unlimited: false,
        },
        "Monthly Window ($60)": {
          used: Number(cost30d.toFixed(4)),
          total: 60,
          remaining: Number(Math.max(0, 60 - cost30d).toFixed(4)),
          unlimited: false,
        },
      },
    };
  } catch (error) {
    console.error("[OpenCode Go Usage] Error fetching from DB:", error);
    return {
      plan: "OpenCode Go ($10/mo)",
      message: `OpenCode Go connected. Unable to calculate local usage: ${error.message}. View official details at opencode.ai/auth.`,
      quotas: {},
    };
  }
}
