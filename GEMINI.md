# 9router Project Architecture & Development Guidelines

This document provides context for AI agents working on the 9router project to ensure consistent, bug-free feature development.

## Core Architecture

9router is a Next.js application designed to act as a universal proxy, router, and multiplexer for various AI Code Tools (Claude Code, Cursor, Gemini CLI, etc.) connecting to numerous AI Providers (OpenAI, Anthropic, Google AI Studio, custom models, etc.).

### Directory Structure & Separation of Concerns

*   **`src/`**: Contains the Next.js frontend (App Router) and API routes (`src/app/api`).
    *   **Frontend**: Built with React, Tailwind CSS. Avoid modifying core layout logic unless explicitly requested. Custom components should follow existing patterns (e.g., `src/app/(dashboard)/dashboard/usage/components/ComboPathVisualizer.js`).
    *   **API Routes**: Handle standard web requests, dashboard authentication, settings updates, and proxy configuration management.
*   **`open-sse/`**: **CRITICAL BACKEND LOGIC**. This directory handles the core proxying, SSE (Server-Sent Events) streaming, request translation, and executor logic.
    *   **`open-sse/executors/`**: Contains the logic for connecting to specific upstream AI providers (e.g., Anthropic, OpenAI, Gemini).
    *   **`open-sse/services/`**: Core services like `combo.js` (managing model fallback/combinations), token refreshing, and usage tracking.
    *   **`open-sse/translator/`**: Handles translating requests/responses between different AI tool formats (e.g., converting a Cursor request to Anthropic format).
*   **`cli/`**: Contains the command-line interface logic for 9router.
*   **`.9router/` (Runtime Data)**: Located in the user's home directory (`~/.9router`). This is where the SQLite database, logs, and automatically generated secrets are stored. **DO NOT modify the codebase to write hardcoded state into the source directory; always use the data directory.**

## Development Guidelines for AI Agents

1.  **Do Not Merge `9router` and `.9router`**: The source code (`/root/9router`) and the runtime data directory (`/root/.9router`) are strictly separate by design. Never attempt to merge them.
2.  **Provider vs. Client**: Understand the difference between a "Provider" (upstream AI service) and a "Client Tool" (downstream IDE/CLI).
    *   *Note on Spoofed Providers*: Providers like `antigravity` and `gemini-cli` spoof internal IDE API endpoints. They share the same underlying mechanisms. When users ask about adding these, warn them about the high risk of their Google accounts being banned due to ToS violations. Recommend using official API Keys (via Google AI Studio) instead.
3.  **Proxy Pools**: 9router uses a `proxy-pools` mechanism to rotate credentials/endpoints. When modifying routing logic, ensure compatibility with the pool rotation mechanism.
4.  **Database Migrations**: 9router uses SQLite. If you add new fields that require database changes, ensure you follow the existing migration patterns.
5.  **Running & Testing**:
    *   The project uses `npm run build` and runs via `pm2` using the built standalone server (`node .next/standalone/server.js`).
    *   Always verify changes by building and checking PM2 logs (`pm2 logs 9router`).
6.  **Git Workflow**: The project tracks the upstream repository (`origin`) and a custom fork (`custom`). When fetching updates from upstream, always commit local custom features first, pull with `--no-rebase`, and resolve any conflicts before building.

## Recent Custom Features

*   **Combo Path Visualizer** (`ComboPathVisualizer.js`): Fully functional. Displays model names, API key/account names, and latencies for each step in a fallback combo path.
*   **Request Details Tab** (`RequestDetailsTab.js`): Fully functional and optimized. Provides a comprehensive view of request history, including request/provider-response bodies and execution paths. Refactored into smaller components for better maintainability.