"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

const getAntigravityDir = () => path.join(os.homedir(), ".gemini", "antigravity-cli");
const getAntigravityEnvPath = () => path.join(getAntigravityDir(), ".env");

const ensureDir = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
};

const parseEnvFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const env = {};
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
    return env;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
};

const writeEnvFile = async (filePath, env) => {
  const content = Object.entries(env)
    .map(([key, value]) => `${key}="${value}"`)
    .join("\n");
  await fs.writeFile(filePath, content, "utf-8");
};

export async function GET() {
  try {
    const envPath = getAntigravityEnvPath();
    const env = await parseEnvFile(envPath);

    return NextResponse.json({
      installed: true,
      config: Object.keys(env).length > 0 ? Object.entries(env).map(([k, v]) => `${k}="${v}"`).join("\n") : null,
      settingsPath: envPath,
      apiKey: env.ANTIGRAVITY_API_KEY || "",
      baseUrl: env.ANTIGRAVITY_BASE_URL || "",
      model: env.ANTIGRAVITY_MODEL || "",
    });
  } catch (error) {
    console.error("Error reading Antigravity settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { apiKey, baseUrl, model } = await request.json();

    const envDir = getAntigravityDir();
    await ensureDir(envDir);

    const envPath = getAntigravityEnvPath();
    const env = await parseEnvFile(envPath);

    // Update with new values or keep existing if not provided
    if (apiKey !== undefined) env.ANTIGRAVITY_API_KEY = apiKey;
    if (baseUrl !== undefined) env.ANTIGRAVITY_BASE_URL = baseUrl;
    if (model !== undefined) env.ANTIGRAVITY_MODEL = model;

    await writeEnvFile(envPath, env);

    return NextResponse.json({ success: true, settingsPath: envPath });
  } catch (error) {
    console.error("Error saving Antigravity settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
