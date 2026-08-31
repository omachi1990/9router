export async function register() {
  console.log("[Instrumentation] Registering...");
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Runtime is Node.js, initializing app...");
    const { default: initializeApp } = await import("./shared/services/initializeApp.js");
    await initializeApp();

    const { initConsoleLogCapture } = await import("@/lib/consoleLogBuffer");
    initConsoleLogCapture();

    // Server-only: lets capabilities.js read the synced catalog without pulling
    // node:fs into the dashboard's browser bundle.
    const { installCatalogSource } = await import("open-sse/providers/catalogOverride.js");
    await installCatalogSource();

    const { startModelCatalogSync } = await import("@/lib/modelCatalog/sync.js");
    startModelCatalogSync();
  }
}
