import fs from "fs";
import path from "path";

const CODEX_FILE = path.resolve("/root/9router/open-sse/providers/registry/codex.js");

export function resolveCodexConflict() {
  if (!fs.existsSync(CODEX_FILE)) return false;
  let content = fs.readFileSync(CODEX_FILE, "utf8");

  if (!content.includes("<<<<<<<")) {
    return false; // No conflict markers
  }

  // Extract models block from upstream (between ======= and >>>>>>>)
  const conflictRegex = /<<<<<<< HEAD[\s\S]*?=======\n([\s\S]*?)>>>>>>> [^\n]+/g;
  
  content = content.replace(conflictRegex, (match, upstreamBlock) => {
    // For each model in the upstream block, inject requiredPlan if missing
    const lines = upstreamBlock.split("\n");
    const patchedLines = lines.map(line => {
      if (line.includes("kind: \"image\"") || line.includes("kind: \"stt\"")) {
        if (!line.includes("requiredPlan")) {
          return line.replace(/(\s*)(},?)$/, '$1 requiredPlan: "plus" $2');
        }
      }
      if (line.includes('id: "codex-auto-review"') || line.includes('id: "gpt-daybreak-blue-latest"') || line.includes('id: "gpt-reserve"')) {
        if (!line.includes("requiredPlan")) {
          return line.replace(/(\s*)(},?)$/, '$1 requiredPlan: "free" $2');
        }
      }
      return line;
    });
    return patchedLines.join("\n");
  });

  fs.writeFileSync(CODEX_FILE, content, "utf8");
  return true;
}

if (process.argv[1]?.endsWith("resolve-codex-conflict.mjs")) {
  const resolved = resolveCodexConflict();
  if (resolved) {
    console.log("Successfully auto-resolved open-sse/providers/registry/codex.js");
  } else {
    console.log("No codex conflict markers to resolve.");
  }
}
