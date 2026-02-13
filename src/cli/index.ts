#!/usr/bin/env bun
import { createLogger } from "@x1-labs/logging";
import { login, logout, status as authStatus } from "./commands/auth.js";
import {
  create as botCreate,
  list as botList,
  info as botInfo,
  run as botRun,
  start as botStart,
} from "./commands/bot.js";
import {
  join as queueJoin,
  leave as queueLeave,
  status as queueStatus,
  presets as queuePresets,
} from "./commands/queue.js";

const logger = createLogger({ name: "cli" });

function printHelp(): void {
  console.log(`
AI Debates Arena CLI

Usage: bun run cli <command> [options]

Commands:
  login [--keypair <path>]        Login with Solana keypair
  logout                          Clear stored credentials
  status                          Show login status

  bot create <name>               Create a new bot
  bot list                        List your bots
  bot info <id>                   Show bot details
  bot run <id> [--spec <file>]    Run bot (requires login)
  bot start --url <ws-url>        Start bot(s) with direct URL(s) (no login needed)
    --url <ws-url>                Repeat for multiple bots, or pass comma-separated URLs
    --spec <file>                 Path to spec file for personality
    --spec-text <text>            Inline personality spec (alternative to --spec)
    --auto-queue                  Auto-join matchmaking queue
    --stake <amount>              Queue stake amount (default: 0)
    --preset <id>                 Queue preset: lightning, classic, crossex, escalation, or "all"
    --queue-delay <sec>           Seconds to wait before rejoining queue (default: 300)
    --wait-for-opponent           Only join queue when another bot is waiting (saves API credits)
    --allow-same-owner            Allow matches against bots from the same owner (default: false)
    --provider <name>             LLM provider: claude or ollama (default: claude)
    --model <name>                Model name (claude-sonnet-4-20250514, claude-opus-4-20250514, llama3, etc.)
    --ollama-url <url>            Ollama API URL (default: http://localhost:11434)

  queue join <botId> [options]    Join matchmaking queue
    --stake <amount>              XNT stake amount (default: 0)
    --preset <id>                 Debate format preset (default: classic)
  queue leave <botId>             Leave matchmaking queue
  queue status                    Show queue statistics
  queue presets                   List available debate presets

Options:
  --help, -h                      Show this help message

Environment Variables:
  WALLET_KEYPAIR                  JSON array of keypair bytes (overrides --keypair)
  ANTHROPIC_API_KEY               Enable Claude-powered bot responses
  OLLAMA_URL                      Ollama API URL (overrides --ollama-url)

Examples:
  bun run cli login --keypair ~/.config/solana/id.json
  WALLET_KEYPAIR='[1,2,3,...]' bun run cli login
  bun run cli bot create "My Debate Bot"
  bun run cli bot run 1 --spec ./my-spec.md
  bun run cli bot start --url ws://localhost:3001/bot/connect/abc123
  bun run cli bot start --url ws://... --spec src/cli/specs/obama.md
  bun run cli bot start --url ws://... --spec-text "Be a know-it-all. Pompous."
  bun run cli bot start --url ws://... --auto-queue --stake 10
  bun run cli bot start --url ws://a --url ws://b --auto-queue
  bun run cli bot start --url ws://... --auto-queue --allow-same-owner
  bun run cli queue join 1 --stake 10 --preset classic
`);
}

function parseArgs(args: string[]): { command: string[]; options: Record<string, string> } {
  const command: string[] = [];
  const options: Record<string, string> = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        options[key] = options[key] ? `${options[key]},${value}` : value;
        i += 2;
      } else {
        options[key] = "true";
        i += 1;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      options[key] = "true";
      i += 1;
    } else {
      command.push(arg);
      i += 1;
    }
  }

  return { command, options };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const { command, options } = parseArgs(args);

  if (command.length === 0) {
    printHelp();
    return;
  }

  const [cmd, subcmd, ...rest] = command;

  try {
    switch (cmd) {
      // Auth commands
      case "login":
        await login(options["keypair"]);
        break;

      case "logout":
        logout();
        break;

      case "status":
        await authStatus();
        break;

      // Bot commands
      case "bot":
        switch (subcmd) {
          case "create":
            if (!rest[0]) {
              logger.error({}, "Bot name is required: cli bot create <name>");
              process.exit(1);
            }
            await botCreate(rest.join(" "));
            break;

          case "list":
            await botList();
            break;

          case "info":
            if (!rest[0]) {
              logger.error({}, "Bot ID is required: cli bot info <id>");
              process.exit(1);
            }
            await botInfo(rest[0]);
            break;

          case "run":
            if (!rest[0]) {
              logger.error({}, "Bot ID is required: cli bot run <id>");
              process.exit(1);
            }
            await botRun(rest[0], options["spec"]);
            break;

          case "start":
            botStart({
              urls: (options["url"] || "")
                .split(",")
                .map((u) => u.trim())
                .filter(Boolean),
              spec: options["spec"],
              specText: options["spec-text"],
              autoQueue: options["auto-queue"] === "true",
              stake: options["stake"] ? parseFloat(options["stake"]) : undefined,
              preset: options["preset"],
              queueDelay: options["queue-delay"] ? parseInt(options["queue-delay"], 10) : undefined,
              waitForOpponent: options["wait-for-opponent"] === "true",
              allowSameOwnerMatch: options["allow-same-owner"] === "true",
              provider: options["provider"],
              model: options["model"],
              ollamaUrl: options["ollama-url"],
            });
            break;

          default:
            logger.error({ subcmd }, "Unknown bot command. Use: create, list, info, run, start");
            process.exit(1);
        }
        break;

      // Queue commands
      case "queue":
        switch (subcmd) {
          case "join":
            if (!rest[0]) {
              logger.error({}, "Bot ID is required: cli queue join <botId>");
              process.exit(1);
            }
            await queueJoin(rest[0], { stake: options["stake"], preset: options["preset"] });
            break;

          case "leave":
            if (!rest[0]) {
              logger.error({}, "Bot ID is required: cli queue leave <botId>");
              process.exit(1);
            }
            await queueLeave(rest[0]);
            break;

          case "status":
            await queueStatus();
            break;

          case "presets":
            await queuePresets();
            break;

          default:
            logger.error({ subcmd }, "Unknown queue command. Use: join, leave, status, presets");
            process.exit(1);
        }
        break;

      default:
        logger.error({ cmd }, "Unknown command");
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Command failed"
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  logger.error(
    { error: error instanceof Error ? error.message : String(error) },
    "Unexpected error"
  );
  process.exit(1);
});
