import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
const anthropic = new Anthropic();

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

// Build system prompt based on word limits
function buildSystemPrompt(wordLimit: { min: number; max: number }): string {
  return `You are a skilled debater participating in a competitive AI debate arena.

IMPORTANT CONSTRAINTS:
- Your response MUST be between ${wordLimit.min} and ${wordLimit.max} words
- Aim for approximately ${Math.floor((wordLimit.min + wordLimit.max) / 2)} words
- Be persuasive, well-reasoned, and engaging
- Directly address the topic and your assigned position
- When countering, specifically address your opponent's arguments
- Be professional but compelling

You will be given a topic, your position (pro or con), the current round type, and any previous messages.`;
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

app.post("/debate", async (req, res) => {
  const debateReq: DebateRequest = req.body;
  const { round, topic, position, opponent_last_message } = debateReq;

  // Default word limits if not provided (for backward compatibility)
  const word_limit = debateReq.word_limit ?? { min: 100, max: 300 };
  const time_limit = debateReq.time_limit_seconds ?? 60;

  console.log("\n" + "=".repeat(80));
  console.log(`[Claude Bot] REQUEST`);
  console.log("=".repeat(80));
  console.log(`Debate ID: ${debateReq.debate_id}`);
  console.log(`Round: ${round} | Position: ${position.toUpperCase()}`);
  console.log(`Topic: "${topic}"`);
  console.log(`Word limit: ${word_limit.min}-${word_limit.max} | Time limit: ${time_limit}s`);
  if (opponent_last_message) {
    console.log(`Opponent's last message: "${opponent_last_message.slice(0, 100)}${opponent_last_message.length > 100 ? '...' : ''}"`);
  }
  console.log(`Messages so far: ${debateReq.messages_so_far.length}`);

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
    const wordCount = responseText.split(/\s+/).filter(w => w.length > 0).length;

    console.log("-".repeat(80));
    console.log(`[Claude Bot] RESPONSE (${latencyMs}ms, ${wordCount} words)`);
    console.log("-".repeat(80));
    console.log(responseText);
    console.log("=".repeat(80) + "\n");

    res.json({
      message: responseText,
      confidence: 0.9,
    });
  } catch (error) {
    console.error("-".repeat(80));
    console.error("[Claude Bot] ERROR:", error);
    console.error("=".repeat(80) + "\n");
    res.json({
      message: `[Error generating response - falling back to default ${position} argument]`,
      confidence: 0.5,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", bot: "claude-debater" });
});

// Use provided PORT or pick a random one between 4100-4999
const PORT = process.env.PORT || 4100 + Math.floor(Math.random() * 900);

const server = app.listen(PORT, () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Claude Debate Bot                               ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:${actualPort}/debate                  ║
║  Health:   http://localhost:${actualPort}/health                  ║
║                                                           ║
║  Make sure ANTHROPIC_API_KEY is set!                      ║
║                                                           ║
║  Register this bot at http://localhost:5173/bots          ║
╚═══════════════════════════════════════════════════════════╝
`);
});
