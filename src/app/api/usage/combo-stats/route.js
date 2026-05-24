import { getAdapter } from "@/lib/db/driver";
import { NextResponse } from "next/server";
import { parseJson } from "@/lib/db/helpers/jsonCol";

export async function GET(request) {
  try {
    const db = await getAdapter();
    const combos = db.all("SELECT name, models FROM combos");
    
    const modelToComboMap = new Map();
    combos.forEach(c => {
      const models = parseJson(c.models, []);
      models.forEach(m => {
        modelToComboMap.set(m, c.name);
      });
    });

    const rows = db.all(`
      SELECT 
        json_extract(data, '$.request.model') as modelId,
        provider,
        timestamp,
        json_extract(data, '$.tokens.completion_tokens') as compTokens,
        json_extract(data, '$.tokens.prompt_tokens') as promptTokens
      FROM requestDetails
      ORDER BY timestamp DESC
      LIMIT 50
    `);

    const stats = rows.map(row => ({
      modelId: row.modelId,
      comboName: modelToComboMap.get(row.modelId) || "-",
      provider: row.provider,
      timestamp: row.timestamp,
      tokens: (row.compTokens || 0) + (row.promptTokens || 0)
    }));

    return NextResponse.json({ comboStats: stats });
  } catch (error) {
    console.error("Failed to fetch combo stats:", error);
    return NextResponse.json({ comboStats: [] }, { status: 500 });
  }
}
