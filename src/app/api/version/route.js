import https from "https";
import pkg from "../../../../package.json" with { type: "json" };

const NPM_PACKAGE_NAME = "9router";
const VERSION_CACHE_TTL_MS = 3600000;
const UPSTREAM_REPO = "decolua/9router";

const versionCache = (global.__npmVersionCache ??= { value: null, fetchedAt: 0 });
const upstreamCache = (global.__upstreamVersionCache ??= { value: null, fetchedAt: 0 });

function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(
      `https://registry.npmjs.org/${NPM_PACKAGE_NAME}/latest`,
      { timeout: 4000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).version || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function fetchUpstreamLatestTag() {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${UPSTREAM_REPO}/tags?per_page=5`,
      headers: { "User-Agent": "9router-fork", "Accept": "application/vnd.github+json" },
      timeout: 4000,
    };
    const req = https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const tags = JSON.parse(data);
          if (!Array.isArray(tags) || tags.length === 0) {
            resolve(null);
            return;
          }
          const versionTags = tags
            .map((t) => t.name)
            .filter((n) => /^v?\d+\.\d+\.\d+$/.test(n))
            .map((n) => n.replace(/^v/, ""));
          if (versionTags.length === 0) {
            resolve(null);
            return;
          }
          versionTags.sort((a, b) => compareVersions(b, a));
          resolve(versionTags[0]);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function getLatestVersionCached() {
  if (versionCache.value && Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL_MS) {
    return versionCache.value;
  }
  const latest = await fetchLatestVersion();
  if (latest) {
    versionCache.value = latest;
    versionCache.fetchedAt = Date.now();
  }
  return latest;
}

async function getUpstreamVersionCached() {
  if (upstreamCache.value && Date.now() - upstreamCache.fetchedAt < VERSION_CACHE_TTL_MS) {
    return upstreamCache.value;
  }
  const latest = await fetchUpstreamLatestTag();
  if (latest) {
    upstreamCache.value = latest;
    upstreamCache.fetchedAt = Date.now();
  }
  return latest;
}

export async function GET() {
  const versionParts = pkg.version.split("-");
  const currentVersion = versionParts[0];
  const forkSuffix = versionParts[1] || "";

  const latestVersion = await getLatestVersionCached();
  const upstreamVersion = await getUpstreamVersionCached();

  const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;
  const upstreamBehind = upstreamVersion ? compareVersions(upstreamVersion, currentVersion) > 0 : false;

  return Response.json({
    currentVersion: pkg.version,
    mainVersion: currentVersion,
    forkSuffix,
    latestVersion,
    upstreamVersion,
    hasUpdate,
    upstreamBehind,
  });
}
