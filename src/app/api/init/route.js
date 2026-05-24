import initializeApp from "@/shared/services/initializeApp.js";

// This API route is called automatically to initialize app
export async function GET() {
  try {
    await initializeApp();
    return new Response("Initialized", { status: 200 });
  } catch (error) {
    console.error("[Init API] error:", error);
    return new Response("Initialization failed: " + error.message, { status: 500 });
  }
}
