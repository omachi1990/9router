import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/lib/localDb";
import { getProviderModels, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { pingModelByKind } from "@/app/api/models/test/ping";

/**
 * POST /api/providers/[id]/test-models-for-connection
 * Test all models for a specific connection and return which ones work.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const providerId = connection.provider;
    const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
    const models = getProviderModels(alias);

    if (models.length === 0) {
      return NextResponse.json({ error: "No models configured", results: [] }, { status: 200 });
    }

    const baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;
    const connectionId = connection.id;

    // Filter to only LLM models (skip image/embedding/etc for speed)
    const llmModels = models.filter(m => !m.kind || m.kind === "llm");

    const results = [];

    // Test first model to trigger token refresh
    if (llmModels.length > 0) {
      const first = llmModels[0];
      const result = await pingModelByKind(`${alias}/${first.id}`, "llm", baseUrl, connectionId);
      results.push({
        modelId: first.id,
        name: first.name || first.id,
        requiredPlan: first.requiredPlan || null,
        ...result,
      });

      // Test remaining models in parallel (batch of 3 to avoid rate limits)
      const rest = llmModels.slice(1);
      for (let i = 0; i < rest.length; i += 3) {
        const batch = rest.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(async (model) => {
            const result = await pingModelByKind(`${alias}/${model.id}`, "llm", baseUrl, connectionId);
            return {
              modelId: model.id,
              name: model.name || model.id,
              requiredPlan: model.requiredPlan || null,
              ...result,
            };
          })
        );
        results.push(...batchResults);
      }
    }

    return NextResponse.json({
      connectionId: id,
      provider: providerId,
      email: connection.email,
      planType: connection.providerSpecificData?.chatgptPlanType || "unknown",
      results,
    });
  } catch (error) {
    console.error("Error testing models for connection:", error);
    return NextResponse.json({ error: "Test failed" }, { status: 500 });
  }
}
