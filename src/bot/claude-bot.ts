import Anthropic from "@anthropic-ai/sdk";
import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
const anthropic = new Anthropic();

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

// Bot specification loaded from markdown files
let botSpec: string | null = null;

/**
 * Load bot specification from a file or directory of markdown files
 */
function loadBotSpec(specPath: string): string {
  const resolvedPath = path.resolve(specPath);
  const stat = fs.statSync(resolvedPath);

  if (stat.isFile()) {
    // Single file - just read it
    console.log(`[Claude Bot] Loading spec from file: ${resolvedPath}`);
    return fs.readFileSync(resolvedPath, "utf-8");
  } else if (stat.isDirectory()) {
    // Directory - read all .md files
    console.log(`[Claude Bot] Loading specs from directory: ${resolvedPath}`);
    const files = fs
      .readdirSync(resolvedPath)
      .filter((f) => f.endsWith(".md"))
      .sort(); // Alphabetical order for consistency

    if (files.length === 0) {
      throw new Error(`No markdown files found in ${resolvedPath}`);
    }

    const contents: string[] = [];
    for (const file of files) {
      const filePath = path.join(resolvedPath, file);
      console.log(`[Claude Bot]   - ${file}`);
      const content = fs.readFileSync(filePath, "utf-8");
      contents.push(`# ${file}\n\n${content}`);
    }

    return contents.join("\n\n---\n\n");
  } else {
    throw new Error(`${resolvedPath} is neither a file nor a directory`);
  }
}

// Build system prompt based on word limits and optional bot spec
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

// Get round-specific instructions
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

async function generateResponse(
  request: DebateRequestMessage
): Promise<{ message: string; confidence: number }> {
  const { round, topic, position, opponent_last_message, word_limit, time_limit_seconds } = request;

  console.log("\n" + "=".repeat(80));
  console.log(`[Claude Bot] REQUEST`);
  console.log("=".repeat(80));
  console.log(`Debate ID: ${request.debate_id}`);
  console.log(`Round: ${round} | Position: ${position.toUpperCase()}`);
  console.log(`Topic: "${topic}"`);
  console.log(
    `Word limit: ${word_limit.min}-${word_limit.max} | Time limit: ${time_limit_seconds}s`
  );
  if (opponent_last_message) {
    console.log(
      `Opponent's last message: "${opponent_last_message.slice(0, 100)}${opponent_last_message.length > 100 ? "..." : ""}"`
    );
  }
  console.log(`Messages so far: ${request.messages_so_far.length}`);

  const systemPrompt = buildSystemPrompt(word_limit);

  // Build the user prompt
  let userPrompt = `Topic: "${topic}"
Your position: ${position.toUpperCase()} (you must ${position === "pro" ? "support" : "oppose"} this proposition)
Round type: ${round.toUpperCase()}
Word limit: ${word_limit.min}-${word_limit.max} words`;

  if (opponent_last_message) {
    userPrompt += `\n\nYour opponent's last statement:\n"${opponent_last_message}"`;
  }

  userPrompt += `\n\n${getRoundInstructions(round)}`;

  // Calculate max tokens based on word limit (words * 1.5 for tokens estimate)
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

    console.log("-".repeat(80));
    console.log(`[Claude Bot] RESPONSE (${latencyMs}ms, ${wordCount} words)`);
    console.log("-".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80) + "\n");

    return {
      message: responseText,
      confidence: 0.9,
    };
  } catch (error) {
    console.error("-".repeat(80));
    console.error("[Claude Bot] ERROR:", error);
    console.error("=".repeat(80) + "\n");
    return {
      message: `[Error generating response - falling back to default ${position} argument]`,
      confidence: 0.5,
    };
  }
}

function connect(url: string): void {
  console.log(`[Claude Bot] Connecting to ${url}...`);

  const ws = new WebSocket(url);
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30000;

  ws.on("open", () => {
    console.log("[Claude Bot] WebSocket connected");
    reconnectAttempts = 0;
  });

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString()) as ServerMessage;

      switch (message.type) {
        case "connected":
          console.log(`[Claude Bot] Authenticated as "${message.botName}" (ID: ${message.botId})`);
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        case "debate_request":
          console.log(`[Claude Bot] Received debate request ${message.requestId}`);
          const response = await generateResponse(message);
          ws.send(
            JSON.stringify({
              type: "debate_response",
              requestId: message.requestId,
              message: response.message,
              confidence: response.confidence,
            })
          );
          break;

        default:
          console.warn("[Claude Bot] Unknown message type:", (message as { type: string }).type);
      }
    } catch (error) {
      console.error("[Claude Bot] Error handling message:", error);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[Claude Bot] Disconnected: ${code} ${reason.toString()}`);

    // Reconnect with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;
    console.log(`[Claude Bot] Reconnecting in ${delay}ms...`);
    setTimeout(() => connect(url), delay);
  });

  ws.on("error", (error) => {
    console.error("[Claude Bot] WebSocket error:", error.message);
  });
}

// Main
const url = process.argv[2];
const specPath = process.argv[3];

if (!url) {
  console.error(`
╔═══════════════════════════════════════════════════════════╗
║           Claude Debate Bot                               ║
╠═══════════════════════════════════════════════════════════╣
║  Usage: bun run claude <websocket-url> [spec-path]        ║
║                                                           ║
║  Arguments:                                               ║
║    websocket-url  Connection URL from bot registration    ║
║    spec-path      Optional: markdown file or directory    ║
║                   defining bot personality/strategy       ║
║                                                           ║
║  Examples:                                                ║
║    bun run claude ws://localhost:3001/bot/connect/abc123  ║
║    bun run claude ws://... ./my-bot-spec.md               ║
║    bun run claude ws://... ./bot-specs/                   ║
║                                                           ║
║  Spec File Format:                                        ║
║    Your markdown file(s) can define:                      ║
║    - Personality traits and debate style                  ║
║    - Strategic approaches for different rounds            ║
║    - Rhetorical techniques to employ                      ║
║    - Topics of expertise or special knowledge             ║
║                                                           ║
║  Get your connection URL by registering a bot at:         ║
║    http://localhost:5173/bots                             ║
║                                                           ║
║  Make sure ANTHROPIC_API_KEY is set!                      ║
╚═══════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[Claude Bot] ERROR: ANTHROPIC_API_KEY environment variable is not set");
  process.exit(1);
}

// Load bot spec if provided
if (specPath) {
  try {
    botSpec = loadBotSpec(specPath);
    console.log(`[Claude Bot] Loaded spec (${botSpec.length} characters)`);
  } catch (error) {
    console.error(
      `[Claude Bot] ERROR loading spec: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Claude Debate Bot                               ║
╠═══════════════════════════════════════════════════════════╣
║  Connecting via WebSocket...                              ║
${specPath ? `║  Spec: ${specPath.slice(0, 47).padEnd(47)}║\n` : ""}║  Make sure ANTHROPIC_API_KEY is set!                      ║
╚═══════════════════════════════════════════════════════════╝
`);

connect(url);
