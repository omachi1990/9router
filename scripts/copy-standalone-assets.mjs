import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
