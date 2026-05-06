const CLAUDE_MESSAGES_URL = "https://api.anthropic.com/v1/messages?beta=true";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildPayload(body) {
  if (Array.isArray(body.messages)) {
    return {
      model: body.model || "claude-sonnet-4-5-20250929",
      max_tokens: body.max_tokens || body.maxTokens || 64,
      messages: body.messages,
      ...(body.system ? { system: body.system } : {}),
    };
  }

  return {
    model: body.model || "claude-sonnet-4-5-20250929",
    max_tokens: body.max_tokens || body.maxTokens || 64,
    messages: [
      {
        role: "user",
        content: body.prompt || body.message || "Say hello from 9Router Cloud.",
      },
    ],
  };
}

export async function handleTestClaude(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const apiKey = body.apiKey || body.api_key;
  const accessToken = body.accessToken || body.access_token;
  if (!apiKey && !accessToken) {
    return jsonResponse({ error: "apiKey or accessToken is required" }, 400);
  }

  const headers = {
    "Content-Type": "application/json",
    "Anthropic-Version": body.anthropicVersion || "2023-06-01",
    "Anthropic-Beta": body.anthropicBeta || "claude-code-20250219,interleaved-thinking-2025-05-14",
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  } else {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(CLAUDE_MESSAGES_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(buildPayload(body)),
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
