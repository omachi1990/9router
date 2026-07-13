import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const standaloneDir = join(distDir, "standalone");

if (!existsSync(standaloneDir)) {
  console.warn(`[build] Standalone output not found: ${standaloneDir}`);
  process.exit(0);
}

const staticDir = join(distDir, "static");
if (existsSync(staticDir)) {
  await mkdir(join(standaloneDir, distDir), { recursive: true });
  await cp(staticDir, join(standaloneDir, distDir, "static"), { recursive: true, force: true });
}

if (existsSync("public")) {
  await cp("public", join(standaloneDir, "public"), { recursive: true, force: true });
}

const sqlJsWasmDir = join("node_modules", "sql.js", "dist");
const standaloneSqlJsDir = join(standaloneDir, sqlJsWasmDir);
if (existsSync(sqlJsWasmDir) && !existsSync(join(standaloneSqlJsDir, "sql-wasm.wasm"))) {
  await mkdir(standaloneSqlJsDir, { recursive: true });
  for (const f of ["sql-wasm.wasm", "sql-wasm-debug.wasm", "sql-wasm-browser.wasm", "sql-wasm-browser-debug.wasm"]) {
    const src = join(sqlJsWasmDir, f);
    if (existsSync(src)) {
      await cp(src, join(standaloneSqlJsDir, f), { force: true });
    }
  }
  console.log("[build] Copied sql.js wasm files to standalone");
}

const betterSqliteDir = join("node_modules", "better-sqlite3");
const standaloneBetterSqliteDir = join(standaloneDir, betterSqliteDir);
if (existsSync(betterSqliteDir) && existsSync(join(betterSqliteDir, "build"))) {
  await mkdir(standaloneBetterSqliteDir, { recursive: true });
  await cp(betterSqliteDir, standaloneBetterSqliteDir, { recursive: true, force: true });
  console.log("[build] Copied better-sqlite3 to standalone");
}
