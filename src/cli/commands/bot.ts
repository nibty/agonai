import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";
import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@x1-labs/logging";
import { isLoggedIn } from "../lib/config.js";
import { post, get, type CreateBotResponse, type BotsResponse } from "../lib/api.js";

const logger = createLogger({ name: "cli-bot" });

// Round types from the preset system
type RoundType =
  | "opening"
  | "argument"
  | "rebuttal"
  | "counter"
  | "closing"
  | "question"
  | "answer";

// Message types from server
interface DebateRequestMessage {
  type: "debate_request";
  requestId: string;
  debate_id: string;
  round: RoundType;
  topic: string;
  position: "pro" | "con";
  opponent_last_message: string | null;
  time_limit_seconds: number;
  word_limit: { min: number; max: number };
  char_limit: { min: number; max: number };
  messages_so_far: Array<{ round: number; position: "pro" | "con"; content: string }>;
}

interface ConnectedMessage {
  type: "connected";
  botId: number;
  botName: string;
}

interface PingMessage {
  type: "ping";
}

type ServerMessage = DebateRequestMessage | ConnectedMessage | PingMessage;

/**
 * Create a new bot
 */
export async function create(name: string): Promise<void> {
  if (!isLoggedIn()) {
    logger.error({}, "Not logged in. Use 'cli login' first.");
    process.exit(1);
  }

  if (!name || name.trim().length === 0) {
    logger.error({}, "Bot name is required");
    process.exit(1);
  }

  logger.info({ name }, "Creating bot");
  const result = await post<CreateBotResponse>("/bots", { name: name.trim() });

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Failed to create bot");
    process.exit(1);
  }

  const { bot, connectionUrl } = result.data;

  console.log(`\nBot created successfully!`);
  console.log(`ID: ${bot.id}`);
  console.log(`Name: ${bot.name}`);
  console.log(`ELO: ${bot.elo}`);
  console.log(`\nConnection URL:`);
  console.log(connectionUrl);
  console.log(`\nTo run this bot:`);
  console.log(`  bun run cli bot run ${bot.id}`);
}

/**
 * List user's bots
 */
export async function list(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error({}, "Not logged in. Use 'cli login' first.");
    process.exit(1);
  }

  const result = await get<BotsResponse>("/bots/my");

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Failed to list bots");
    process.exit(1);
  }

  const { bots } = result.data;

  if (bots.length === 0) {
    console.log("\nNo bots found. Create one with 'cli bot create <name>'");
    return;
  }

  console.log("\nYour bots:");
  console.log("─".repeat(70));
  console.log(
    `${"ID".padEnd(6)} ${"Name".padEnd(20)} ${"ELO".padEnd(8)} ${"W/L".padEnd(10)} ${"Status".padEnd(12)}`
  );
  console.log("─".repeat(70));

  for (const bot of bots) {
    const status = bot.isConnected ? "Connected" : bot.isActive ? "Active" : "Inactive";
    console.log(
      `${String(bot.id).padEnd(6)} ${bot.name.slice(0, 19).padEnd(20)} ${String(bot.elo).padEnd(8)} ${`${bot.wins}/${bot.losses}`.padEnd(10)} ${status.padEnd(12)}`
    );
  }
}

/**
 * Get bot info including connection URL
 */
export async function info(botId: string): Promise<void> {
  if (!isLoggedIn()) {
    logger.error({}, "Not logged in. Use 'cli login' first.");
    process.exit(1);
  }

  const result = await get<BotsResponse>("/bots/my");

  if (result.error || !result.data) {
    logger.error({ error: result.error }, "Failed to get bot info");
    process.exit(1);
  }

  const bot = result.data.bots.find((b) => b.id === parseInt(botId, 10));
  if (!bot) {
    logger.error({ botId }, "Bot not found or you don't own it");
    process.exit(1);
  }

  console.log(`\nBot: ${bot.name}`);
  console.log(`ID: ${bot.id}`);
  console.log(`ELO: ${bot.elo}`);
  console.log(`Wins: ${bot.wins} | Losses: ${bot.losses}`);
  console.log(`Status: ${bot.isConnected ? "Connected" : bot.isActive ? "Active" : "Inactive"}`);
}

// Bot personality for simple mode (no Claude)
function getSimpleResponse(
  round: RoundType,
  topic: string,
  position: "pro" | "con"
): { message: string; confidence: number } {
  const stance = position === "pro" ? "support" : "oppose";

  const responses: Record<RoundType, string> = {
    opening: `I ${stance} the proposition "${topic}". This position is supported by evidence and logical reasoning.`,
    argument: `Continuing my argument to ${stance} "${topic}": the data clearly shows the merits of this position.`,
    rebuttal: `My opponent's arguments fail to address the core issue. I maintain my position to ${stance} this proposition.`,
    counter: `The rebuttal does not change the fundamental facts. My position remains strong.`,
    closing: `In conclusion, the evidence clearly supports my position to ${stance} "${topic}".`,
    question: `How do you reconcile your position with the established evidence?`,
    answer: `The answer is clear when you examine the facts objectively.`,
  };

  return {
    message: responses[round] || `I ${stance} this position.`,
    confidence: 0.75,
  };
}

// Claude-powered response generation
let anthropic: Anthropic | null = null;
let botSpec: string | null = null;

function loadBotSpec(specPath: string): string {
  const resolvedPath = path.resolve(specPath);
  const stat = fs.statSync(resolvedPath);

  if (stat.isFile()) {
    logger.info({ path: resolvedPath }, "Loading spec from file");
    return fs.readFileSync(resolvedPath, "utf-8");
  } else if (stat.isDirectory()) {
    logger.info({ path: resolvedPath }, "Loading specs from directory");
    const files = fs
      .readdirSync(resolvedPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    if (files.length === 0) {
      throw new Error(`No markdown files found in ${resolvedPath}`);
    }

    const contents: string[] = [];
    for (const file of files) {
      const filePath = path.join(resolvedPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      contents.push(`# ${file}\n\n${content}`);
    }

    return contents.join("\n\n---\n\n");
  } else {
    throw new Error(`${resolvedPath} is neither a file nor a directory`);
  }
}

function buildSystemPrompt(wordLimit: { min: number; max: number }): string {
  let prompt = `You are a skilled debater participating in a competitive AI debate arena.

IMPORTANT CONSTRAINTS:
- Your response MUST be between ${wordLimit.min} and ${wordLimit.max} words
- Aim for approximately ${Math.floor((wordLimit.min + wordLimit.max) / 2)} words
- Be persuasive, well-reasoned, and engaging
- Directly address the topic and your assigned position
- When countering, specifically address your opponent's arguments
- Be professional but compelling

You will be given a topic, your position (pro or con), the current round type, and any previous messages.`;

  if (botSpec) {
    prompt += `

---

## BOT PERSONALITY & STRATEGY SPECIFICATION

The following specification defines your personality, debate style, and strategic approach. Follow these guidelines while still adhering to the word limits and debate format above.

${botSpec}`;
  }

  return prompt;
}

function getRoundInstructions(round: RoundType): string {
  const instructions: Record<RoundType, string> = {
    opening:
      "Deliver your opening statement. State your position clearly and present your main arguments.",
    argument:
      "Present a focused argument supporting your position. Build on your previous points with new evidence or reasoning.",
    rebuttal:
      "Deliver your rebuttal. Directly counter your opponent's arguments and reinforce your position.",
    counter:
      "Counter your opponent's rebuttal. Address their specific points and show why your argument still stands.",
    closing:
      "Deliver your closing statement. Summarize your key arguments, address remaining objections, and make a final compelling case.",
    question:
      "Ask a pointed, strategic question designed to expose weaknesses in your opponent's position. Be direct and specific.",
    answer:
      "Answer your opponent's question directly and honestly, while still defending your position. Turn their question into an opportunity.",
  };
  return instructions[round] || "Present your argument.";
}

async function getClaudeResponse(
  request: DebateRequestMessage
): Promise<{ message: string; confidence: number }> {
  if (!anthropic) {
    return getSimpleResponse(request.round, request.topic, request.position);
  }

  const { round, topic, position, opponent_last_message, word_limit } = request;
  const systemPrompt = buildSystemPrompt(word_limit);

  let userPrompt = `Topic: "${topic}"
Your position: ${position.toUpperCase()} (you must ${position === "pro" ? "support" : "oppose"} this proposition)
Round type: ${round.toUpperCase()}
Word limit: ${word_limit.min}-${word_limit.max} words`;

  if (opponent_last_message) {
    userPrompt += `\n\nYour opponent's last statement:\n"${opponent_last_message}"`;
  }

  userPrompt += `\n\n${getRoundInstructions(round)}`;

  const maxTokens = Math.min(2000, Math.max(200, word_limit.max * 2));

  try {
    const startTime = Date.now();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "I stand by my position.";

    const latencyMs = Date.now() - startTime;
    const wordCount = responseText.split(/\s+/).filter((w) => w.length > 0).length;

    logger.info({ latencyMs, wordCount }, "Generated Claude response");

    return {
      message: responseText,
      confidence: 0.9,
    };
  } catch (error) {
    logger.error({ error }, "Error generating Claude response, using fallback");
    return getSimpleResponse(round, topic, position);
  }
}

/**
 * Run a bot (connect to WebSocket and respond to debates)
 */
export async function run(botId: string, specPath?: string): Promise<void> {
  if (!isLoggedIn()) {
    logger.error({}, "Not logged in. Use 'cli login' first.");
    process.exit(1);
  }

  // Get bot's connection URL by regenerating token
  const tokenResult = await post<{ connectionToken: string; connectionUrl: string }>(
    `/bots/${botId}/regenerate-token`
  );

  if (tokenResult.error || !tokenResult.data) {
    logger.error(
      { error: tokenResult.error },
      "Failed to get connection URL. Do you own this bot?"
    );
    process.exit(1);
  }

  const { connectionUrl } = tokenResult.data;

  // Check if Claude is available
  if (process.env["ANTHROPIC_API_KEY"]) {
    anthropic = new Anthropic();
    logger.info({}, "Claude API available - using AI responses");
  } else {
    logger.info({}, "No ANTHROPIC_API_KEY - using simple responses");
  }

  // Load bot spec if provided
  if (specPath) {
    try {
      botSpec = loadBotSpec(specPath);
      logger.info({ specLength: botSpec.length }, "Loaded bot spec");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to load spec"
      );
      process.exit(1);
    }
  }

  console.log(`\nConnecting bot ${botId} to WebSocket...`);
  connect(connectionUrl);
}

function connect(url: string): void {
  logger.info({ url }, "Connecting to WebSocket");

  const ws = new WebSocket(url);
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30000;

  ws.on("open", () => {
    logger.info({}, "WebSocket connected");
    console.log("Connected! Waiting for debates...");
    reconnectAttempts = 0;
  });

  ws.on("message", (data: Buffer) => {
    void (async () => {
      try {
        const message = JSON.parse(data.toString("utf-8")) as ServerMessage;

        switch (message.type) {
          case "connected":
            logger.info(
              { botName: message.botName, botId: message.botId },
              "Authenticated with server"
            );
            console.log(`Authenticated as: ${message.botName} (ID: ${message.botId})`);
            break;

          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;

          case "debate_request": {
            logger.info(
              {
                round: message.round,
                position: message.position,
                topic: message.topic.slice(0, 50),
              },
              "Received debate request"
            );
            console.log(`\nDebate request: ${message.round} round, position: ${message.position}`);
            console.log(`Topic: ${message.topic}`);

            const response = anthropic
              ? await getClaudeResponse(message)
              : getSimpleResponse(message.round, message.topic, message.position);

            ws.send(
              JSON.stringify({
                type: "debate_response",
                requestId: message.requestId,
                message: response.message,
                confidence: response.confidence,
              })
            );
            logger.info({}, "Response sent");
            console.log("Response sent!");
            break;
          }

          default:
            logger.warn(
              { messageType: (message as { type: string }).type },
              "Unknown message type"
            );
        }
      } catch (error) {
        logger.error({ error }, "Error handling message");
      }
    })();
  });

  ws.on("close", (code, reason) => {
    logger.info({ code, reason: reason.toString() }, "Disconnected");
    console.log("Disconnected from server. Reconnecting...");

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;
    setTimeout(() => connect(url), delay);
  });

  ws.on("error", (error) => {
    logger.error({ error: error.message }, "WebSocket error");
  });
}
