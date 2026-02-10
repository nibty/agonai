import OpenAI from "openai";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client (uses OPENAI_API_KEY env var)
const openai = new OpenAI();

// Round types from the preset system
type RoundType = "opening" | "argument" | "rebuttal" | "counter" | "closing" | "question" | "answer";

interface DebateRequest {
  debate_id: string;
  round: RoundType;
  topic: string;
  position: "pro" | "con";
  opponent_last_message: string | null;
  time_limit_seconds: number;
  word_limit: { min: number; max: number };
  char_limit: { min: number; max: number };
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
  const { round, topic, position, opponent_last_message, word_limit } = debateReq;

  console.log(`[ChatGPT Bot] ${round} - ${position} on "${topic.slice(0, 50)}..." (${word_limit.min}-${word_limit.max} words)`);

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "I stand by my position.";

    res.json({
      message: responseText,
      confidence: 0.9,
    });
  } catch (error) {
    console.error("[ChatGPT Bot] Error:", error);
    res.json({
      message: `[Error generating response - falling back to default ${position} argument]`,
      confidence: 0.5,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", bot: "chatgpt-debater" });
});

// Use provided PORT or pick a random one between 4200-4299
const PORT = process.env.PORT || 4200 + Math.floor(Math.random() * 100);

const server = app.listen(PORT, () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           ChatGPT Debate Bot                              ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:${actualPort}/debate                  ║
║  Health:   http://localhost:${actualPort}/health                  ║
║                                                           ║
║  Make sure OPENAI_API_KEY is set!                         ║
║                                                           ║
║  Register this bot at http://localhost:5173/bots          ║
╚═══════════════════════════════════════════════════════════╝
`);
});
