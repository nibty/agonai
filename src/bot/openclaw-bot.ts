/**
 * OpenClaw Bridge Bot
 *
 * Connects the AI Debates bot interface to an OpenClaw gateway instance.
 * Exposes a standard HTTP bot endpoint that internally calls OpenClaw's
 * OpenAI-compatible chat completions API.
 *
 * Flow: AI Debates System → openclaw-bot.ts → OpenClaw Gateway → AI Agent → Response
 *
 * Environment variables:
 *   OPENCLAW_URL - Gateway URL (e.g., http://localhost:18789)
 *   OPENCLAW_TOKEN - Gateway authentication token (optional)
 *   OPENCLAW_AGENT - Agent ID to use (default: main)
 *   PORT - Optional port override (default: 4200)
 */

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Configuration from environment
const OPENCLAW_URL = process.env.OPENCLAW_URL || "http://localhost:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || "";
const OPENCLAW_AGENT = process.env.OPENCLAW_AGENT || "main";
const DEFAULT_TIMEOUT_MS = 120000;

// Round types from the preset system
type RoundType = "opening" | "argument" | "rebuttal" | "counter" | "closing" | "question" | "answer";

interface DebateRequest {
  debate_id: string;
  round: RoundType;
  topic: string;
  position: "pro" | "con";
  opponent_last_message: string | null;
  time_limit_seconds?: number;
  word_limit?: { min: number; max: number };
  char_limit?: { min: number; max: number };
  messages_so_far: Array<{ round: number; position: string; content: string }>;
}

// OpenAI-compatible response format
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

// Get round-specific instructions
function getRoundInstructions(round: RoundType): string {
  const instructions: Record<RoundType, string> = {
    opening: "Deliver your opening statement. State your position clearly and present your main arguments.",
    argument: "Present a focused argument supporting your position. Build on your previous points with new evidence or reasoning.",
    rebuttal: "Deliver your rebuttal. Directly counter your opponent's arguments and reinforce your position.",
    counter: "Counter your opponent's rebuttal. Address their specific points and show why your argument still stands.",
    closing: "Deliver your closing statement. Summarize your key arguments, address remaining objections, and make a final compelling case.",
    question: "Ask a pointed, strategic question designed to expose weaknesses in your opponent's position. Be direct and specific.",
    answer: "Answer your opponent's question directly and honestly, while still defending your position. Turn their question into an opportunity.",
  };
  return instructions[round] || "Present your argument.";
}

// Build the prompt message for OpenClaw
function buildPrompt(req: DebateRequest): string {
  const wordLimit = req.word_limit ?? { min: 100, max: 300 };
  const positionName = req.position === "pro" ? "PRO (support)" : "CON (oppose)";

  let message = `You are participating in a competitive AI debate.

DEBATE TOPIC: "${req.topic}"
YOUR POSITION: ${positionName}
CURRENT ROUND: ${req.round.toUpperCase()}
WORD LIMIT: ${wordLimit.min}-${wordLimit.max} words

IMPORTANT CONSTRAINTS:
- Your response MUST be between ${wordLimit.min} and ${wordLimit.max} words
- Be persuasive, well-reasoned, and engaging
- Directly address the topic and your assigned position
- Be professional but compelling`;

  if (req.opponent_last_message) {
    message += `

OPPONENT'S LAST STATEMENT:
"${req.opponent_last_message}"`;
  }

  if (req.messages_so_far.length > 0) {
    message += `

DEBATE HISTORY:`;
    for (const msg of req.messages_so_far) {
      message += `\n[Round ${msg.round} - ${msg.position.toUpperCase()}]: ${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}`;
    }
  }

  message += `

TASK: ${getRoundInstructions(req.round)}

Respond with ONLY your debate argument. No meta-commentary or explanations.`;

  return message;
}

app.post("/debate", async (req, res) => {
  const debateReq: DebateRequest = req.body;
  const { round, topic, position, opponent_last_message } = debateReq;

  const wordLimit = debateReq.word_limit ?? { min: 100, max: 300 };
  const timeLimit = debateReq.time_limit_seconds ?? 120;
  const timeoutMs = Math.min(timeLimit * 1000, DEFAULT_TIMEOUT_MS);

  console.log("\n" + "=".repeat(80));
  console.log(`[OpenClaw Bot] REQUEST`);
  console.log("=".repeat(80));
  console.log(`Debate ID: ${debateReq.debate_id}`);
  console.log(`Round: ${round} | Position: ${position.toUpperCase()}`);
  console.log(`Topic: "${topic}"`);
  console.log(`Word limit: ${wordLimit.min}-${wordLimit.max} | Time limit: ${timeLimit}s`);
  if (opponent_last_message) {
    console.log(`Opponent's last message: "${opponent_last_message.slice(0, 100)}${opponent_last_message.length > 100 ? "..." : ""}"`);
  }
  console.log(`Messages so far: ${debateReq.messages_so_far.length}`);

  const prompt = buildPrompt(debateReq);

  // Use session key for multi-turn context within the same debate
  const sessionKey = `debate-${debateReq.debate_id}-${position}`;

  try {
    const startTime = Date.now();

    // Call OpenClaw's OpenAI-compatible chat completions endpoint
    const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
        "x-openclaw-session-key": sessionKey,
      },
      body: JSON.stringify({
        model: `openclaw:${OPENCLAW_AGENT}`,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenClaw returned ${response.status}: ${errorText}`);
    }

    const data: OpenAIChatResponse = await response.json();
    const responseText = data.choices?.[0]?.message?.content;

    if (!responseText) {
      throw new Error("OpenClaw returned empty response");
    }

    const latencyMs = Date.now() - startTime;
    const wordCount = responseText.split(/\s+/).filter((w) => w.length > 0).length;

    console.log("-".repeat(80));
    console.log(`[OpenClaw Bot] RESPONSE (${latencyMs}ms, ${wordCount} words)`);
    console.log("-".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80) + "\n");

    res.json({
      message: responseText,
      confidence: 0.85,
    });
  } catch (error) {
    console.error("-".repeat(80));
    console.error("[OpenClaw Bot] ERROR:", error);
    console.error("=".repeat(80) + "\n");

    const errorMessage = error instanceof Error ? error.message : String(error);

    res.json({
      message: `[Error communicating with OpenClaw: ${errorMessage}]`,
      confidence: 0.3,
    });
  }
});

app.get("/health", async (_req, res) => {
  // Check if OpenClaw is reachable
  let openclawStatus = "unknown";
  try {
    const response = await fetch(`${OPENCLAW_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    openclawStatus = response.ok ? "connected" : `error (${response.status})`;
  } catch {
    openclawStatus = "unreachable";
  }

  res.json({
    status: "ok",
    bot: "openclaw-bridge",
    openclaw: {
      url: OPENCLAW_URL,
      agent: OPENCLAW_AGENT,
      status: openclawStatus,
      tokenConfigured: !!OPENCLAW_TOKEN,
    },
  });
});

// Use provided PORT or default to 4200
const PORT = process.env.PORT || 4200;

const server = app.listen(PORT, () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OpenClaw Debate Bot (Bridge)                    ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:${String(actualPort).padEnd(5)}/debate                 ║
║  Health:   http://localhost:${String(actualPort).padEnd(5)}/health                 ║
║                                                           ║
║  OpenClaw: ${OPENCLAW_URL.padEnd(44)}║
║  Agent:    ${OPENCLAW_AGENT.padEnd(44)}║
║  Token:    ${OPENCLAW_TOKEN ? "configured" : "not set (optional)"}${" ".repeat(OPENCLAW_TOKEN ? 33 : 24)}║
║                                                           ║
║  Setup:                                                   ║
║    1. npm install -g openclaw@latest                      ║
║    2. openclaw onboard --install-daemon                   ║
║    3. openclaw gateway --port 18789                       ║
║    4. Enable chatCompletions in ~/.openclaw/openclaw.json ║
║                                                           ║
║  Register at http://localhost:5173/bots as HTTP bot       ║
║  with endpoint: http://localhost:${String(actualPort).padEnd(5)}/debate              ║
╚═══════════════════════════════════════════════════════════╝
`);
});
