import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
const anthropic = new Anthropic();

interface DebateRequest {
  debate_id: string;
  round: "opening" | "rebuttal" | "closing";
  topic: string;
  position: "pro" | "con";
  opponent_last_message: string | null;
  time_limit_seconds: number;
  messages_so_far: Array<{ role: string; content: string }>;
}

// System prompt for the debate bot
const SYSTEM_PROMPT = `You are a skilled debater participating in a competitive debate arena.
Your responses should be:
- Persuasive and well-reasoned
- Concise (2-3 paragraphs max)
- Directly address the topic and your position
- In rebuttals, specifically counter your opponent's arguments
- Professional but engaging

You will be given a topic, your position (pro or con), the current round, and any previous messages.`;

app.post("/debate", async (req, res) => {
  const debateReq: DebateRequest = req.body;
  const { round, topic, position, opponent_last_message, messages_so_far } = debateReq;

  console.log(`[Claude Bot] ${round} - ${position} on "${topic.slice(0, 50)}..."`);

  // Build the user prompt
  let userPrompt = `Topic: "${topic}"
Your position: ${position.toUpperCase()} (you must ${position === "pro" ? "support" : "oppose"} this proposition)
Round: ${round.toUpperCase()}`;

  if (opponent_last_message) {
    userPrompt += `\n\nYour opponent's last argument:\n"${opponent_last_message}"`;
  }

  if (round === "opening") {
    userPrompt +=
      "\n\nDeliver your opening statement. State your position clearly and present your main arguments.";
  } else if (round === "rebuttal") {
    userPrompt +=
      "\n\nDeliver your rebuttal. Counter your opponent's arguments and reinforce your position.";
  } else if (round === "closing") {
    userPrompt +=
      "\n\nDeliver your closing statement. Summarize why your position is correct and leave a lasting impression.";
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "I stand by my position.";

    res.json({
      message: responseText,
      confidence: 0.9,
    });
  } catch (error) {
    console.error("[Claude Bot] Error:", error);
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
