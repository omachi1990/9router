import { getComboByName, createCombo, updateCombo, getApiKeys } from "@/lib/localDb";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { getConsistentMachineId } from "@/shared/utils/machineId";

const CLI_TOKEN_SALT = "9r-cli-auth";
const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INITIAL_DELAY_MS = 10 * 1000; // 10 seconds after boot

// Models that are known to return 400 "Model is unavailable"
const KNOWN_DEAD_FREE_MODELS = new Set([
  "deepseek-v4-flash-free",
  "space-bunny-free"
]);

// Non-suffix free models
const KNOWN_FREE_MODELS = ["big-pickle", "union-alpha"];

const g = global.__opencodeFreeSyncSingleton ??= {
  timer: null,
  inProgress: false,
  lastSync: null,
};

async function getInternalHeaders() {
  let apiKey = null;
  try {
    const keys = await getApiKeys();
    const activeKeys = keys.filter((k) => k.isActive !== false);
    apiKey = (activeKeys.find((k) => !k.access?.restricted) || activeKeys[0])?.key || null;
  } catch {}

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  try {
    headers["x-9r-cli-token"] = await getConsistentMachineId(CLI_TOKEN_SALT);
  } catch {}
  return headers;
}

export async function fetchFreeModelCandidates() {
  const candidates = [];

  // 1. Fetch OpenCode Zen / Free models
  try {
    const res = await fetch("https://opencode.ai/zen/v1/models", { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const raw = json.data ?? json.models ?? [];
      if (Array.isArray(raw)) {
        for (const m of raw) {
          const id = m.id || m.name;
          if (!id || typeof id !== "string") continue;
          if (KNOWN_DEAD_FREE_MODELS.has(id)) continue;
          if (id.endsWith("-free") || KNOWN_FREE_MODELS.includes(id)) {
            candidates.push(`oc/${id}`);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[OpenCodeFreeSync] Failed to fetch zen models:", err.message);
  }

  // 2. Fetch OpenCode Go models
  try {
    const res = await fetch("https://opencode.ai/zen/go/v1/models", { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const raw = json.data ?? json.models ?? [];
      if (Array.isArray(raw)) {
        for (const m of raw) {
          const id = m.id || m.name;
          if (!id || typeof id !== "string") continue;
          if (KNOWN_DEAD_FREE_MODELS.has(id)) continue;
          if (id.endsWith("-free") || KNOWN_FREE_MODELS.includes(id)) {
            candidates.push(`ocg/${id}`);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[OpenCodeFreeSync] Failed to fetch opencode-go models:", err.message);
  }

  // Deduplicate preserving order
  return Array.from(new Set(candidates));
}

export async function probeSingleModel(model, baseUrl, headers) {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say ok in one word" }],
        max_tokens: 32,
        stream: false,
      }),
      signal: AbortSignal.timeout(12000),
    });

    const latencyMs = Date.now() - start;
    const rawText = await res.text().catch(() => "");
    const cleaned = rawText.replace(/\s*data:\s*\[DONE\]\s*$/, "").trim();

    let parsed = null;
    try {
      parsed = cleaned ? JSON.parse(cleaned) : null;
    } catch {}

    if (!res.ok) {
      const detail = parsed?.error?.message || parsed?.msg || parsed?.message || parsed?.error || cleaned;
      return {
        model,
        ok: false,
        status: res.status,
        latencyMs,
        error: `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 160)}` : ""}`,
      };
    }

    const hasChoices = Array.isArray(parsed?.choices) && parsed.choices.length > 0;
    if (!hasChoices) {
      return {
        model,
        ok: false,
        status: res.status,
        latencyMs,
        error: "No choices returned in response",
      };
    }

    return {
      model,
      ok: true,
      status: 200,
      latencyMs,
      error: null,
    };
  } catch (err) {
    return {
      model,
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      error: err.name === "TimeoutError" ? "Timeout after 12s" : err.message,
    };
  }
}

export async function syncAndTestFreeModels({ probe = true } = {}) {
  if (g.inProgress) {
    return { inProgress: true, ...g.lastSync };
  }
  g.inProgress = true;

  try {
    const candidates = await fetchFreeModelCandidates();
    if (candidates.length === 0) {
      console.warn("[OpenCodeFreeSync] No free model candidates found from OpenCode APIs");
      return { success: false, error: "No candidates found" };
    }

    const baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort || 20128}`;
    const headers = await getInternalHeaders();
    const results = [];

    if (probe) {
      // Run with concurrency = 2 to avoid overwhelming endpoints
      const CONCURRENCY = 2;
      for (let i = 0; i < candidates.length; i += CONCURRENCY) {
        const batch = candidates.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map((model) => probeSingleModel(model, baseUrl, headers))
        );
        results.push(...batchResults);
      }
    } else {
      for (const m of candidates) {
        results.push({ model: m, ok: true, status: 200, latencyMs: 0, error: null });
      }
    }

    const passedModels = results.filter((r) => r.ok).map((r) => r.model);

    // Update combo_free in DB if we found at least 1 working model
    let combo = await getComboByName("combo_free");
    if (passedModels.length > 0) {
      if (combo) {
        await updateCombo(combo.id, { models: passedModels });
      } else {
        await createCombo({
          name: "combo_free",
          kind: null,
          models: passedModels,
        });
      }
      console.log(`[OpenCodeFreeSync] Updated combo_free (${passedModels.length} models):`, passedModels.join(", "));
    } else {
      console.warn("[OpenCodeFreeSync] None of the candidate models passed testing, keeping existing combo_free");
    }

    const summary = {
      timestamp: new Date().toISOString(),
      candidatesCount: candidates.length,
      passedCount: passedModels.length,
      passedModels,
      results,
    };
    g.lastSync = summary;
    return { success: true, ...summary };
  } catch (error) {
    console.error("[OpenCodeFreeSync] Sync failed:", error);
    return { success: false, error: error.message };
  } finally {
    g.inProgress = false;
  }
}

export function getLatestFreeModelsSyncStatus() {
  return {
    inProgress: g.inProgress,
    lastSync: g.lastSync,
  };
}

export function startFreeModelAutoSync() {
  if (g.timer) return;
  // Trigger first sync after startup delay
  setTimeout(() => {
    syncAndTestFreeModels({ probe: true }).catch((e) =>
      console.warn("[OpenCodeFreeSync] Initial sync failed:", e.message)
    );
  }, INITIAL_DELAY_MS);

  // Recurring hourly sync
  g.timer = setInterval(() => {
    syncAndTestFreeModels({ probe: true }).catch((e) =>
      console.warn("[OpenCodeFreeSync] Scheduled sync failed:", e.message)
    );
  }, AUTO_SYNC_INTERVAL_MS);

  console.log("[OpenCodeFreeSync] Background auto-sync scheduler started");
}

export function stopFreeModelAutoSync() {
  if (g.timer) {
    clearInterval(g.timer);
    g.timer = null;
  }
}
