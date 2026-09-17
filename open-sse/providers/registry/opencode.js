export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
  uiAlias: "oc",
  display: {
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    headers: {
      "x-opencode-client": "desktop",
    },
    noAuth: true,
  },
  models: [
    // Muse Spark models are served by /zen/v1/responses; the rest stay on
    // /chat/completions, so the format is declared per-model, not per-provider.
    { id: "muse-spark-1.2-contributor-free", name: "Muse Spark 1.2 Contributor Free", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor Free", targetFormat: "openai-responses" },
    { id: "mimo-v2.5-free", name: "MIMO v2.5 Free", targetFormat: "openai" },
    { id: "ling-3.0-flash-fin-free", name: "Ling 3.0 Flash Fin Free", targetFormat: "openai" },
    { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", targetFormat: "openai" },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free", targetFormat: "openai" },
    { id: "big-pickle", name: "Big Pickle", targetFormat: "openai" },
    { id: "union-alpha", name: "Union Alpha", targetFormat: "openai" },
  ],
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
