export async function register() {
  console.log("[Instrumentation] Registering...");
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Runtime is Node.js, initializing app...");
    const { default: initializeApp } = await import("./shared/services/initializeApp.js");
    await initializeApp();
  }
}
