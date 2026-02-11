#!/usr/bin/env bun
/**
 * Backwards compatibility wrapper for: bun run claude <ws-url> [spec-path]
 * Translates to: bun run cli bot start --url <ws-url> [--spec <spec-path>]
 */
import { start } from "../commands/bot.js";

const url = process.argv[2];
const spec = process.argv[3];

if (!url) {
  console.log(`
Usage: bun run claude <ws-url> [spec-path]

Arguments:
  ws-url      WebSocket connection URL from bot registration
  spec-path   Optional: markdown file or directory defining bot personality

Examples:
  bun run claude ws://localhost:3001/bot/connect/abc123
  bun run claude ws://... ./my-spec.md
  bun run claude ws://... src/cli/specs/obama.md

Requires ANTHROPIC_API_KEY environment variable.
`);
  process.exit(1);
}

if (!process.env["ANTHROPIC_API_KEY"]) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

start({ url, spec });
