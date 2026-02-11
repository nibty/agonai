import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";
import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@x1-labs/logging";
import { isLoggedIn } from "../lib/config.js";
import { post, get, type CreateBotResponse, type BotsResponse } from "../lib/api.js";

// Provider types
type LLMProvider = "claude" | "ollama";

interface OllamaConfig {
  baseUrl: string;
  model: string;
}

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
  hasActiveDebate?: boolean;
}

interface PingMessage {
  type: "ping";
}

interface QueueJoinedMessage {
  type: "queue_joined";
  queueIds: string[];
  stake: number;
  presetIds: string[];
}

interface QueueLeftMessage {
  type: "queue_left";
}

interface QueueErrorMessage {
  type: "queue_error";
  error: string;
}

interface DebateCompleteMessage {
  type: "debate_complete";
  debateId: number;
  won: boolean | null;
  eloChange: number;
}

type ServerMessage =
  | DebateRequestMessage
  | ConnectedMessage
  | PingMessage
  | QueueJoinedMessage
  | QueueLeftMessage
  | QueueErrorMessage
  | DebateCompleteMessage;

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

// LLM provider configuration
let currentProvider: LLMProvider = "claude";
let anthropic: Anthropic | null = null;
let ollamaConfig: OllamaConfig | null = null;
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
- Make sure to reference your opponent's arguments

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

// Rate limit handling configuration
const RATE_LIMIT_MAX_RETRIES = 5;
const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 60000;

interface RateLimitInfo {
  requestsLimit: number;
  requestsRemaining: number;
  requestsReset: string;
  retryAfter?: number;
}

function parseRateLimitHeaders(headers: Record<string, string>): RateLimitInfo | null {
  const limit = headers["anthropic-ratelimit-requests-limit"];
  const remaining = headers["anthropic-ratelimit-requests-remaining"];
  const reset = headers["anthropic-ratelimit-requests-reset"];
  const retryAfter = headers["retry-after"];

  if (!limit || !remaining || !reset) return null;

  return {
    requestsLimit: parseInt(limit, 10),
    requestsRemaining: parseInt(remaining, 10),
    requestsReset: reset,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
  };
}

function isRateLimitError(
  error: unknown
): error is { status: number; headers?: Record<string, string> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 429
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getClaudeResponse(
  request: DebateRequestMessage
): Promise<{ message: string; confidence: number }> {
  if (!anthropic) {
    logger.debug({}, "No Anthropic client, using simple response");
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

  logger.debug(
    {
      round,
      position,
      maxTokens,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      hasSpec: !!botSpec,
    },
    "Preparing Claude API request"
  );

  // Retry loop with exponential backoff for rate limits
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      logger.debug({ attempt, maxRetries: RATE_LIMIT_MAX_RETRIES }, "Calling Claude API");
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

      logger.info(
        {
          latencyMs,
          wordCount,
          attempt,
          model: message.model,
          inputTokens: message.usage?.input_tokens,
          outputTokens: message.usage?.output_tokens,
          stopReason: message.stop_reason,
        },
        "Generated Claude response"
      );

      return {
        message: responseText,
        confidence: 0.9,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "Unknown";

      logger.debug(
        {
          attempt,
          errorName,
          errorMessage,
          isRateLimit: isRateLimitError(error),
        },
        "Claude API error occurred"
      );

      if (isRateLimitError(error)) {
        const headers = (error as { headers?: Record<string, string> }).headers || {};
        const rateLimitInfo = parseRateLimitHeaders(headers);

        // Calculate backoff delay
        let delayMs: number;
        if (rateLimitInfo?.retryAfter) {
          // Use server-provided retry-after if available
          delayMs = rateLimitInfo.retryAfter * 1000;
        } else {
          // Exponential backoff with jitter
          const baseDelay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          delayMs = Math.min(baseDelay + jitter, RATE_LIMIT_MAX_DELAY_MS);
        }

        logger.error(
          {
            attempt: attempt + 1,
            maxRetries: RATE_LIMIT_MAX_RETRIES,
            delayMs,
            requestsRemaining: rateLimitInfo?.requestsRemaining ?? "unknown",
            requestsLimit: rateLimitInfo?.requestsLimit ?? "unknown",
            resetAt: rateLimitInfo?.requestsReset ?? "unknown",
            retryAfter: rateLimitInfo?.retryAfter ?? "none",
          },
          "Rate limited by Claude API, backing off"
        );

        if (attempt < RATE_LIMIT_MAX_RETRIES) {
          await sleep(delayMs);
          continue;
        }

        logger.error(
          { attempts: attempt + 1 },
          "Exhausted rate limit retries, using fallback response"
        );
        return getSimpleResponse(round, topic, position);
      }

      // Non-rate-limit error
      logger.error(
        {
          errorName,
          errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Error generating Claude response, using fallback"
      );
      return getSimpleResponse(round, topic, position);
    }
  }

  // Should not reach here, but just in case
  logger.warn({}, "Exited retry loop unexpectedly, using fallback");
  return getSimpleResponse(round, topic, position);
}

// Ollama API response generation
interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

async function getOllamaResponse(
  request: DebateRequestMessage
): Promise<{ message: string; confidence: number }> {
  if (!ollamaConfig) {
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

  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now();

      const response = await fetch(`${ollamaConfig.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaConfig.model,
          messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - back off and retry
          const baseDelay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          const delayMs = Math.min(baseDelay + jitter, RATE_LIMIT_MAX_DELAY_MS);

          logger.error(
            { attempt: attempt + 1, maxRetries: RATE_LIMIT_MAX_RETRIES, delayMs },
            "Rate limited by Ollama, backing off"
          );

          if (attempt < RATE_LIMIT_MAX_RETRIES) {
            await sleep(delayMs);
            continue;
          }

          logger.error(
            { attempts: attempt + 1 },
            "Exhausted rate limit retries, using fallback response"
          );
          return getSimpleResponse(round, topic, position);
        }

        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      const responseText = data.message?.content || "I stand by my position.";

      const latencyMs = Date.now() - startTime;
      const wordCount = responseText.split(/\s+/).filter((w) => w.length > 0).length;

      logger.info(
        { latencyMs, wordCount, attempt, model: ollamaConfig.model },
        "Generated Ollama response"
      );

      return {
        message: responseText,
        confidence: 0.85,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error generating Ollama response, using fallback"
      );
      return getSimpleResponse(round, topic, position);
    }
  }

  return getSimpleResponse(round, topic, position);
}

// Unified LLM response function
async function getLLMResponse(
  request: DebateRequestMessage
): Promise<{ message: string; confidence: number }> {
  if (currentProvider === "ollama" && ollamaConfig) {
    return getOllamaResponse(request);
  } else if (anthropic) {
    return getClaudeResponse(request);
  }
  return getSimpleResponse(request.round, request.topic, request.position);
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
  if (isShuttingDown) return;

  logger.info({ url }, "Connecting to WebSocket");

  const ws = new WebSocket(url);
  activeWs = ws;
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30000;

  ws.on("open", () => {
    logger.info({ readyState: ws.readyState }, "WebSocket connected");
    console.log("Connected! Waiting for debates...");
    reconnectAttempts = 0;

    // Log any stale in-flight requests from before reconnect
    if (inFlightRequests.size > 0) {
      logger.warn(
        { count: inFlightRequests.size, requests: Array.from(inFlightRequests.keys()) },
        "Found stale in-flight requests after reconnect - clearing"
      );
      inFlightRequests.clear();
    }
  });

  ws.on("message", (data: Buffer) => {
    const rawMessage = data.toString("utf-8");
    logger.debug(
      { rawMessage: rawMessage.slice(0, 500), length: rawMessage.length },
      "Raw message received"
    );

    void (async () => {
      let parsedMessage: ServerMessage | null = null;

      try {
        parsedMessage = JSON.parse(rawMessage) as ServerMessage;
        logger.debug({ messageType: parsedMessage.type }, "Parsed message type");

        switch (parsedMessage.type) {
          case "connected":
            logger.info(
              { botName: parsedMessage.botName, botId: parsedMessage.botId },
              "Authenticated with server"
            );
            console.log(`Authenticated as: ${parsedMessage.botName} (ID: ${parsedMessage.botId})`);
            break;

          case "ping":
            logger.debug({}, "Received ping, sending pong");
            safeSend(ws, JSON.stringify({ type: "pong" }), {});
            break;

          case "debate_request": {
            const requestStartTime = Date.now();
            const { requestId } = parsedMessage;

            // Track this request
            inFlightRequests.set(requestId, {
              startTime: requestStartTime,
              debateId: parsedMessage.debate_id,
              round: parsedMessage.round,
            });

            logger.info(
              {
                requestId,
                debateId: parsedMessage.debate_id,
                round: parsedMessage.round,
                position: parsedMessage.position,
                topic: parsedMessage.topic,
                timeLimitSeconds: parsedMessage.time_limit_seconds,
                wordLimit: parsedMessage.word_limit,
                inFlightCount: inFlightRequests.size,
              },
              "Received debate request - starting LLM call"
            );
            console.log(
              `\nDebate request: ${parsedMessage.round} round, position: ${parsedMessage.position}`
            );
            console.log(`Topic: ${parsedMessage.topic}`);

            let response: { message: string; confidence: number };
            try {
              logger.debug({ requestId, usingClaude: !!anthropic }, "Calling LLM provider");
              const llmStartTime = Date.now();
              response = anthropic
                ? await getClaudeResponse(parsedMessage)
                : getSimpleResponse(
                    parsedMessage.round,
                    parsedMessage.topic,
                    parsedMessage.position
                  );
              const llmDuration = Date.now() - llmStartTime;
              logger.info(
                {
                  requestId,
                  llmDurationMs: llmDuration,
                  responseLength: response.message.length,
                },
                "LLM response generated successfully"
              );
            } catch (llmError) {
              logger.error(
                {
                  requestId,
                  error: llmError instanceof Error ? llmError.message : String(llmError),
                  stack: llmError instanceof Error ? llmError.stack : undefined,
                },
                "LLM response generation failed, using fallback"
              );
              response = getSimpleResponse(
                parsedMessage.round,
                parsedMessage.topic,
                parsedMessage.position
              );
            }

            const responsePayload = {
              type: "debate_response",
              requestId,
              message: response.message,
              confidence: response.confidence,
            };
            const responseJson = JSON.stringify(responsePayload);

            logger.debug(
              {
                requestId,
                responsePayloadLength: responseJson.length,
                wsReadyState: ws.readyState,
              },
              "Sending response to server"
            );

            const sent = safeSend(ws, responseJson, { requestId });

            // Remove from in-flight tracking
            inFlightRequests.delete(requestId);

            const totalDuration = Date.now() - requestStartTime;
            if (sent) {
              logger.info(
                { requestId, totalDurationMs: totalDuration, inFlightCount: inFlightRequests.size },
                "Response sent successfully"
              );
              console.log("Response sent!");
            } else {
              logger.error(
                { requestId, totalDurationMs: totalDuration },
                "Failed to send response - WebSocket not available"
              );
            }
            break;
          }

          default:
            logger.warn(
              { messageType: (parsedMessage as { type: string }).type },
              "Unknown message type"
            );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            error: errorMsg,
            stack: error instanceof Error ? error.stack : undefined,
            rawMessagePreview: rawMessage.slice(0, 200),
          },
          "Error handling message"
        );

        // If this was a debate_request that failed, try to send error response
        if (parsedMessage?.type === "debate_request") {
          const debateMsg = parsedMessage;
          const requestId = debateMsg.requestId;
          logger.error({ requestId }, "Debate request handling failed - sending fallback");

          const fallback = getSimpleResponse(debateMsg.round, debateMsg.topic, debateMsg.position);
          const errorResponse = {
            type: "debate_response",
            requestId,
            message: fallback.message,
            confidence: fallback.confidence,
          };
          safeSend(ws, JSON.stringify(errorResponse), { requestId });
          inFlightRequests.delete(requestId);
        }
      }
    })();
  });

  ws.on("close", (code, reason) => {
    logger.info({ code, reason: reason.toString() }, "Disconnected");

    // Don't reconnect if shutting down
    if (isShuttingDown) {
      logger.info({}, "Not reconnecting - shutdown in progress");
      return;
    }

    console.log("Disconnected from server. Reconnecting...");

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;
    reconnectTimeout = setTimeout(() => connect(url), delay);
  });

  ws.on("error", (error) => {
    logger.error({ error: error.message }, "WebSocket error");
  });
}

// Auto-queue configuration
interface AutoQueueConfig {
  enabled: boolean;
  stake: number;
  presetId: string;
  delaySeconds: number;
  waitForOpponent: boolean;
  apiBaseUrl: string;
}

let autoQueueConfig: AutoQueueConfig = {
  enabled: false,
  stake: 0,
  presetId: "classic",
  delaySeconds: 0,
  waitForOpponent: false,
  apiBaseUrl: "",
};

/**
 * Derive API base URL from WebSocket URL
 * e.g., wss://api.debate.x1.xyz/bot/connect/abc -> https://api.debate.x1.xyz/api
 */
function getApiBaseUrl(wsUrl: string): string {
  const url = new URL(wsUrl);
  const protocol = url.protocol === "wss:" ? "https:" : "http:";
  return `${protocol}//${url.host}/api`;
}

/**
 * Check how many bots are in the queue
 */
async function getQueueSize(): Promise<number> {
  if (!autoQueueConfig.apiBaseUrl) return 0;

  try {
    const response = await fetch(`${autoQueueConfig.apiBaseUrl}/queue/stats`);
    if (!response.ok) {
      logger.warn({ status: response.status }, "Failed to fetch queue stats");
      return 0;
    }
    const data = (await response.json()) as { queueSize: number };
    return data.queueSize ?? 0;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Error fetching queue stats"
    );
    return 0;
  }
}

/**
 * Wait for an opponent to be in the queue before joining
 */
async function waitForOpponentAndJoin(ws: WebSocket): Promise<void> {
  const pollInterval = 30000; // Check every 30 seconds
  const maxWaitTime = 3600000; // Max 1 hour wait
  const startTime = Date.now();

  const checkAndJoin = async (): Promise<void> => {
    if (ws.readyState !== WebSocket.OPEN) {
      logger.info({}, "WebSocket closed, stopping opponent wait");
      return;
    }

    const queueSize = await getQueueSize();
    logger.debug({ queueSize }, "Checking queue for opponents");

    if (queueSize > 0) {
      logger.info({ queueSize }, `Found ${queueSize} bot(s) in queue, joining...`);
      sendQueueJoin(ws);
      return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitTime) {
      logger.info({}, "Max wait time reached, joining queue anyway");
      sendQueueJoin(ws);
      return;
    }

    const remainingMins = Math.round((maxWaitTime - elapsed) / 60000);
    logger.info(
      { remainingMins, pollIntervalSec: pollInterval / 1000 },
      `No opponents in queue, checking again in 30s (${remainingMins}m remaining)...`
    );
    setTimeout(() => void checkAndJoin(), pollInterval);
  };

  logger.info({}, "Waiting for opponent to join queue...");
  await checkAndJoin();
}

/**
 * Start a bot with a direct WebSocket URL (no login required)
 * This is the main entrypoint for K8s deployments with pre-registered bots
 */
export function start(options: {
  url: string;
  spec?: string;
  autoQueue?: boolean;
  stake?: number;
  preset?: string;
  queueDelay?: number;
  waitForOpponent?: boolean;
  provider?: string;
  model?: string;
  ollamaUrl?: string;
}): void {
  const {
    url,
    spec,
    autoQueue = false,
    stake = 0,
    preset = "classic",
    queueDelay = 300,
    waitForOpponent = false,
    provider = "claude",
    model = "kimi-k2.5:cloud",
    ollamaUrl = "http://localhost:11434",
  } = options;

  // Validate URL
  if (!url) {
    logger.error({}, "WebSocket URL required. Use --url <ws-url>");
    console.log(`
Usage: bun run cli bot start --url <ws-url> [options]

Options:
  --url <ws-url>        WebSocket connection URL (required)
  --spec <file>         Path to spec file or directory
  --auto-queue          Automatically join matchmaking queue
  --stake <amount>      Stake amount for queue (default: 0)
  --preset <id>         Debate preset ID (default: classic)
  --queue-delay <sec>   Seconds to wait before rejoining queue (default: 300)
  --wait-for-opponent   Only join queue when another bot is waiting
  --provider <name>     LLM provider: claude or ollama (default: claude)
  --model <name>        Model name for Ollama (default: kimi-k2.5:cloud)
  --ollama-url <url>    Ollama API URL (default: http://localhost:11434)

Examples:
  # Claude (default)
  bun run cli bot start --url ws://localhost:3001/bot/connect/abc123
  bun run cli bot start --url ws://... --spec ./my-spec.md

  # Ollama with Kimi
  bun run cli bot start --url ws://... --provider ollama
  bun run cli bot start --url ws://... --provider ollama --model kimi
  bun run cli bot start --url ws://... --provider ollama --ollama-url http://192.168.1.100:11434

  # Auto-queue with 30 second delay between debates
  bun run cli bot start --url ws://... --auto-queue --stake 10 --queue-delay 30

  # Wait for opponent before joining (saves API credits)
  bun run cli bot start --url ws://... --auto-queue --wait-for-opponent

Environment Variables:
  ANTHROPIC_API_KEY     Required for Claude provider
  OLLAMA_URL            Override Ollama API URL (alternative to --ollama-url)
`);
    process.exit(1);
  }

  // Validate and configure provider
  const providerLower = provider.toLowerCase() as LLMProvider;
  if (providerLower !== "claude" && providerLower !== "ollama") {
    logger.error({ provider }, "Invalid provider. Use 'claude' or 'ollama'");
    process.exit(1);
  }

  currentProvider = providerLower;

  if (currentProvider === "claude") {
    // Check for Claude API key
    if (!process.env["ANTHROPIC_API_KEY"]) {
      logger.error({}, "ANTHROPIC_API_KEY environment variable is required for Claude provider");
      process.exit(1);
    }
    anthropic = new Anthropic();
    logger.info({}, "Configured Claude provider");
  } else if (currentProvider === "ollama") {
    // Configure Ollama
    const resolvedOllamaUrl = process.env["OLLAMA_URL"] || ollamaUrl;
    ollamaConfig = {
      baseUrl: resolvedOllamaUrl,
      model: model,
    };
    logger.info({ baseUrl: resolvedOllamaUrl, model }, "Configured Ollama provider");
  }

  // Configure auto-queue
  autoQueueConfig = {
    enabled: autoQueue,
    stake,
    presetId: preset,
    delaySeconds: queueDelay,
    waitForOpponent,
    apiBaseUrl: getApiBaseUrl(url),
  };

  // Load spec if provided
  if (spec) {
    try {
      botSpec = loadBotSpec(spec);
      logger.info({ specLength: botSpec.length, spec }, "Loaded bot spec");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to load spec"
      );
      process.exit(1);
    }
  }

  const providerInfo =
    currentProvider === "ollama"
      ? `Ollama (${ollamaConfig?.model})`
      : "Claude (claude-sonnet-4-20250514)";
  logger.info(
    { spec: spec ?? "none", autoQueue, stake, preset, provider: currentProvider },
    `Starting ${providerInfo} bot, connecting to WebSocket...`
  );
  if (autoQueue) {
    logger.info({ stake, preset }, `Auto-queue enabled (stake: ${stake}, preset: ${preset})`);
  }
  connectDirect(url);
}

/**
 * Send queue join request
 */
function sendQueueJoin(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const message = {
    type: "queue_join",
    stake: autoQueueConfig.stake,
    presetId: autoQueueConfig.presetId,
  };
  ws.send(JSON.stringify(message));
  logger.info(
    { stake: autoQueueConfig.stake, preset: autoQueueConfig.presetId },
    "Sent queue_join request"
  );
}

// Track in-flight requests for debugging
const inFlightRequests = new Map<string, { startTime: number; debateId: string; round: string }>();

// Track active WebSocket and timeouts for graceful shutdown
let activeWs: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;
let hasConnectedBefore = false;
const RECONNECT_QUEUE_DELAY_SECONDS = 30; // Delay before rejoining queue after reconnect

function gracefulShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Shutting down bot...");

  // Clear any pending reconnect
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Close WebSocket gracefully
  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    activeWs.close(1000, "Graceful shutdown");
  }

  // Give a moment for close to complete
  setTimeout(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  }, 100);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

/**
 * Safely send a message via WebSocket with error handling
 */
function safeSend(ws: WebSocket, data: string, context: { requestId?: string }): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.error(
      { requestId: context.requestId, wsReadyState: ws.readyState },
      "Cannot send - WebSocket not open"
    );
    return false;
  }

  try {
    ws.send(data);
    return true;
  } catch (error) {
    logger.error(
      {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to send WebSocket message"
    );
    return false;
  }
}

/**
 * Handle a debate request - extracted for cleaner error handling
 */
async function handleDebateRequest(ws: WebSocket, message: DebateRequestMessage): Promise<void> {
  const requestStartTime = Date.now();
  const { requestId } = message;

  // Track this request
  inFlightRequests.set(requestId, {
    startTime: requestStartTime,
    debateId: message.debate_id,
    round: message.round,
  });

  logger.info(
    {
      requestId,
      debateId: message.debate_id,
      round: message.round,
      position: message.position,
      topic: message.topic,
      timeLimitSeconds: message.time_limit_seconds,
      wordLimit: message.word_limit,
      opponentMessageLength: message.opponent_last_message?.length ?? 0,
      messagesSoFar: message.messages_so_far?.length ?? 0,
      inFlightCount: inFlightRequests.size,
    },
    `Debate request: ${message.round} round, position: ${message.position}, topic: ${message.topic}`
  );

  let response: { message: string; confidence: number };
  try {
    logger.debug({ requestId, provider: currentProvider }, "Calling LLM provider");
    const llmStartTime = Date.now();
    response = await getLLMResponse(message);
    const llmDuration = Date.now() - llmStartTime;
    logger.info(
      {
        requestId,
        provider: currentProvider,
        llmDurationMs: llmDuration,
        responseLength: response.message.length,
        responseWordCount: response.message.split(/\s+/).length,
      },
      "LLM response generated successfully"
    );
  } catch (llmError) {
    logger.error(
      {
        requestId,
        error: llmError instanceof Error ? llmError.message : String(llmError),
        stack: llmError instanceof Error ? llmError.stack : undefined,
      },
      "LLM response generation failed, using fallback"
    );
    // Use fallback response to avoid timeout
    response = getSimpleResponse(message.round, message.topic, message.position);
  }

  const responsePayload = {
    type: "debate_response",
    requestId,
    message: response.message,
    confidence: response.confidence,
  };
  const responseJson = JSON.stringify(responsePayload);

  logger.debug(
    {
      requestId,
      responsePayloadLength: responseJson.length,
      wsReadyState: ws.readyState,
    },
    "Sending response to server"
  );

  const sent = safeSend(ws, responseJson, { requestId });

  // Remove from in-flight tracking
  inFlightRequests.delete(requestId);

  const totalDuration = Date.now() - requestStartTime;
  if (sent) {
    logger.info(
      {
        requestId,
        provider: currentProvider,
        totalDurationMs: totalDuration,
        responseLength: response.message.length,
        inFlightCount: inFlightRequests.size,
      },
      "Response sent successfully"
    );
  } else {
    logger.error(
      { requestId, totalDurationMs: totalDuration },
      "Failed to send response - WebSocket not available"
    );
  }
}

/**
 * Connect directly with URL using Claude API
 */
function connectDirect(url: string): void {
  if (isShuttingDown) return;

  logger.info({ url }, "Connecting to WebSocket");

  const ws = new WebSocket(url);
  activeWs = ws;
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30000;

  ws.on("open", () => {
    logger.info({ readyState: ws.readyState }, "WebSocket connected, waiting for debates...");
    reconnectAttempts = 0;

    // Log any stale in-flight requests from before reconnect
    if (inFlightRequests.size > 0) {
      logger.warn(
        { count: inFlightRequests.size, requests: Array.from(inFlightRequests.keys()) },
        "Found stale in-flight requests after reconnect - clearing"
      );
      inFlightRequests.clear();
    }
  });

  ws.on("message", (data: Buffer) => {
    const rawMessage = data.toString("utf-8");
    logger.debug(
      { rawMessage: rawMessage.slice(0, 500), length: rawMessage.length },
      "Raw message received"
    );

    void (async () => {
      let parsedMessage: ServerMessage | null = null;

      try {
        parsedMessage = JSON.parse(rawMessage) as ServerMessage;
        logger.debug({ messageType: parsedMessage.type }, "Parsed message type");

        switch (parsedMessage.type) {
          case "connected": {
            const isReconnect = hasConnectedBefore;
            hasConnectedBefore = true;
            const hasActiveDebate = parsedMessage.hasActiveDebate ?? false;

            logger.info(
              {
                botName: parsedMessage.botName,
                botId: parsedMessage.botId,
                isReconnect,
                hasActiveDebate,
              },
              `Authenticated as: ${parsedMessage.botName} (ID: ${parsedMessage.botId})`
            );

            // Don't auto-join queue if bot has active debates
            if (hasActiveDebate) {
              logger.info({}, "Bot has active debate, skipping queue join");
              break;
            }

            // Auto-join queue if enabled
            if (autoQueueConfig.enabled) {
              const joinQueue = (): void => {
                if (ws.readyState !== WebSocket.OPEN || isShuttingDown) return;
                if (autoQueueConfig.waitForOpponent) {
                  void waitForOpponentAndJoin(ws);
                } else {
                  sendQueueJoin(ws);
                }
              };

              if (isReconnect) {
                // Delay rejoining queue after reconnect to let server stabilize
                logger.info(
                  { delaySeconds: RECONNECT_QUEUE_DELAY_SECONDS },
                  `Waiting ${RECONNECT_QUEUE_DELAY_SECONDS}s before rejoining queue (reconnect)`
                );
                setTimeout(joinQueue, RECONNECT_QUEUE_DELAY_SECONDS * 1000);
              } else {
                joinQueue();
              }
            }
            break;
          }

          case "ping":
            logger.debug({}, "Received ping, sending pong");
            safeSend(ws, JSON.stringify({ type: "pong" }), {});
            break;

          case "queue_joined":
            logger.info(
              {
                queueIds: parsedMessage.queueIds,
                stake: parsedMessage.stake,
                presets: parsedMessage.presetIds,
              },
              `Joined ${parsedMessage.presetIds.length} queue(s): ${parsedMessage.presetIds.join(", ")} (stake: ${parsedMessage.stake})`
            );
            break;

          case "queue_left":
            logger.info({}, "Left matchmaking queue");
            break;

          case "queue_error":
            logger.error({ error: parsedMessage.error }, `Queue error: ${parsedMessage.error}`);
            break;

          case "debate_complete": {
            const resultStr =
              parsedMessage.won === true ? "Won" : parsedMessage.won === false ? "Lost" : "Tied";
            const eloStr =
              parsedMessage.eloChange >= 0
                ? `+${parsedMessage.eloChange}`
                : `${parsedMessage.eloChange}`;
            logger.info(
              {
                debateId: parsedMessage.debateId,
                result: resultStr,
                eloChange: parsedMessage.eloChange,
              },
              `Debate #${parsedMessage.debateId} completed: ${resultStr} (ELO: ${eloStr})`
            );

            // Auto-rejoin queue if enabled (with delay)
            if (autoQueueConfig.enabled) {
              const delay = autoQueueConfig.delaySeconds;
              const rejoinQueue = (): void => {
                if (ws.readyState !== WebSocket.OPEN) return;
                if (autoQueueConfig.waitForOpponent) {
                  logger.info({}, "Waiting for opponent before rejoining queue");
                  void waitForOpponentAndJoin(ws);
                } else {
                  logger.info({}, "Rejoining queue");
                  sendQueueJoin(ws);
                }
              };

              if (delay > 0) {
                logger.info({ delaySeconds: delay }, `Waiting ${delay}s before rejoining queue`);
                setTimeout(rejoinQueue, delay * 1000);
              } else {
                rejoinQueue();
              }
            }
            break;
          }

          case "debate_request":
            // Handle in separate function with its own error handling
            await handleDebateRequest(ws, parsedMessage);
            break;

          default:
            logger.warn(
              { messageType: (parsedMessage as { type: string }).type },
              "Unknown message type"
            );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            error: errorMsg,
            stack: error instanceof Error ? error.stack : undefined,
            rawMessagePreview: rawMessage.slice(0, 200),
          },
          "Error handling message"
        );

        // If this was a debate_request that failed, try to send error response
        if (parsedMessage?.type === "debate_request") {
          const debateMsg = parsedMessage;
          const requestId = debateMsg.requestId;
          logger.error({ requestId }, "Debate request handling failed - sending fallback");

          const fallback = getSimpleResponse(debateMsg.round, debateMsg.topic, debateMsg.position);
          const errorResponse = {
            type: "debate_response",
            requestId,
            message: fallback.message,
            confidence: fallback.confidence,
          };
          safeSend(ws, JSON.stringify(errorResponse), { requestId });
          inFlightRequests.delete(requestId);
        }
      }
    })();
  });

  ws.on("close", (code, reason) => {
    logger.info({ code, reason: reason.toString() }, "Disconnected from server");

    // Don't reconnect if shutting down
    if (isShuttingDown) {
      logger.info({}, "Not reconnecting - shutdown in progress");
      return;
    }

    logger.info({ reconnectAttempts }, "Reconnecting...");

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;
    reconnectTimeout = setTimeout(() => connectDirect(url), delay);
  });

  ws.on("error", (error) => {
    logger.error({ error: error.message }, "WebSocket error");
  });
}
