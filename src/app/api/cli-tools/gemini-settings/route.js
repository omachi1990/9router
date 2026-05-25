"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

const getGeminiDir = () => process.env.GEMINI_CLI_HOME || path.join(os.homedir(), ".gemini");
const getGeminiEnvPath = () => path.join(getGeminiDir(), ".env");

const checkGeminiInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where gemini" : "which gemini";
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    await execAsync(command, { windowsHide: true });
    return true;
  } catch {
    return false;
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
    const isInstalled = await checkGeminiInstalled();
    const env = await parseEnvFile(getGeminiEnvPath());

    return NextResponse.json({
      installed: isInstalled,
      config: Object.keys(env).length > 0 ? Object.entries(env).map(([k, v]) => `${k}="${v}"`).join("\n") : null,
      settingsPath: getGeminiEnvPath(),
    });
  } catch (error) {
    console.log("Error checking gemini settings:", error);
    return NextResponse.json({ error: "Failed to check gemini settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey, model } = await request.json();

    if (!baseUrl || !model) {
      return NextResponse.json({ error: "baseUrl and model are required" }, { status: 400 });
    }

    const geminiDir = getGeminiDir();
    const envPath = getGeminiEnvPath();

    await fs.mkdir(geminiDir, { recursive: true });

    const env = await parseEnvFile(envPath);

    // Update with 9router settings
    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
    env.GEMINI_API_BASE_URL = normalizedBaseUrl;
    env.GOOGLE_GEMINI_BASE_URL = normalizedBaseUrl; // For compatibility
    env.GEMINI_API_KEY = apiKey || "your_api_key";
    env.GEMINI_MODEL = model;

    await writeEnvFile(envPath, env);

    return NextResponse.json({
      success: true,
      message: "Gemini CLI settings applied successfully!",
      settingsPath: envPath,
    });
  } catch (error) {
    console.log("Error updating gemini settings:", error);
    return NextResponse.json({ error: "Failed to update gemini settings" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const envPath = getGeminiEnvPath();
    const env = await parseEnvFile(envPath);

    delete env.GEMINI_API_BASE_URL;
    delete env.GOOGLE_GEMINI_BASE_URL;
    delete env.GEMINI_API_KEY;
    delete env.GEMINI_MODEL;

    await writeEnvFile(envPath, env);

    return NextResponse.json({
      success: true,
      message: "9Router settings removed from Gemini CLI",
    });
  } catch (error) {
    console.log("Error resetting gemini settings:", error);
    return NextResponse.json({ error: "Failed to reset gemini settings" }, { status: 500 });
  }
}
