import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// =============================================================================
// Bot Personalities
// =============================================================================

interface DebateRequest {
  debate_id: string;
  round: "opening" | "rebuttal" | "closing";
  topic: string;
  position: "pro" | "con";
  opponent_last_message: string | null;
  time_limit_seconds: number;
  messages_so_far: Array<{ role: string; content: string }>;
}

interface DebateResponse {
  message: string;
  confidence?: number;
}

type BotPersonality = (req: DebateRequest) => DebateResponse;

// -----------------------------------------------------------------------------
// Bot: LogicMaster - Analytical and structured
// -----------------------------------------------------------------------------
const logicMaster: BotPersonality = (req) => {
  const { round, topic, position, opponent_last_message } = req;
  const stance = position === "pro" ? "support" : "oppose";

  const responses: Record<string, string> = {
    opening: `Let me present a structured argument to ${stance} the proposition: "${topic}".

First, we must establish the key premises. ${position === "pro"
  ? "The evidence clearly demonstrates that this position leads to net positive outcomes for society."
  : "Upon careful analysis, we find that this position fails to account for significant negative externalities."}

I will demonstrate this through three main points:
1. Historical precedent supports my position
2. Current data validates this approach
3. Future projections confirm the trajectory

The logical conclusion is clear.`,

    rebuttal: `My opponent ${opponent_last_message ? "argues" : "has yet to present"} their case, but let me address the fundamental flaws in the opposing position.

${opponent_last_message
  ? `They claim: "${opponent_last_message.slice(0, 100)}..." However, this reasoning is flawed because it fails to consider the broader systemic implications.`
  : "The opposing view lacks empirical support."}

The data shows that ${position === "pro" ? "adoption" : "rejection"} of this proposition correlates with improved outcomes across multiple metrics.

Furthermore, my opponent has not addressed the core issue at hand.`,

    closing: `In conclusion, I have demonstrated through logical reasoning and evidence that we must ${stance} this proposition.

My opponent has failed to refute the central arguments:
1. The precedent is clear
2. The data is compelling
3. The trajectory is unmistakable

A rational evaluation leads to only one conclusion. I rest my case.`,
  };

  return {
    message: responses[round] || "I stand by my position.",
    confidence: 0.85,
  };
};

// -----------------------------------------------------------------------------
// Bot: DevilsAdvocate - Aggressive and witty
// -----------------------------------------------------------------------------
const devilsAdvocate: BotPersonality = (req) => {
  const { round, topic, position, opponent_last_message } = req;

  const responses: Record<string, string> = {
    opening: `Oh, we're debating "${topic}"? How delightfully controversial!

Let me be crystal clear: ${position === "pro" ? "This is obviously true" : "This is patently absurd"}, and anyone who thinks otherwise hasn't been paying attention.

Here's the uncomfortable truth that my opponent won't tell you: ${position === "pro"
  ? "Progress requires embracing change, not clinging to outdated notions."
  : "Just because something sounds good doesn't mean it works in reality."}

Wake up, people. The evidence is overwhelming.`,

    rebuttal: `*slow clap*

${opponent_last_message
  ? `My opponent says: "${opponent_last_message.slice(0, 80)}..." Really? That's the best argument they could muster?`
  : "I notice my opponent is struggling to formulate a coherent response."}

Let me break this down for everyone: The opposing view is built on wishful thinking and ignores inconvenient facts.

Here's what they don't want you to know: ${position === "pro"
  ? "Every time we've embraced this kind of change, society has benefited."
  : "Every time we've rushed into this, we've regretted it."}

The truth hurts, doesn't it?`,

    closing: `Look, I could keep dismantling my opponent's arguments all day, but let's wrap this up.

The facts are simple:
- I'm right
- They're wrong
- The audience knows it

${position === "pro" ? "Embrace the future" : "Learn from history"}. Vote for reason. Vote for me.

*mic drop*`,
  };

  return {
    message: responses[round] || "My position stands unchallenged.",
    confidence: 0.92,
  };
};

// -----------------------------------------------------------------------------
// Bot: Philosopher - Thoughtful and nuanced
// -----------------------------------------------------------------------------
const philosopher: BotPersonality = (req) => {
  const { round, topic, position, opponent_last_message } = req;

  const responses: Record<string, string> = {
    opening: `The question before us - "${topic}" - invites us to examine not just the practical implications, but the deeper philosophical foundations.

What does it mean to ${position === "pro" ? "affirm" : "question"} such a proposition? We must first understand the assumptions embedded within it.

${position === "pro"
  ? "I propose that this position aligns with fundamental principles of human flourishing and societal progress."
  : "I suggest we exercise epistemic humility and examine whether this proposition withstands rigorous scrutiny."}

Let us reason together, weighing evidence against values, and pragmatism against principle.`,

    rebuttal: `My esteemed opponent raises points worthy of consideration.

${opponent_last_message
  ? `They suggest: "${opponent_last_message.slice(0, 80)}..." This perspective, while understandable, perhaps overlooks a crucial dimension.`
  : "Yet I sense we may be talking past each other."}

The challenge with debates like this is that we often argue about means while disagreeing about ends. What are we truly optimizing for?

I maintain that a ${position === "pro" ? "progressive" : "cautious"} approach better serves human dignity and long-term flourishing.

But I remain open to being persuaded otherwise.`,

    closing: `As we conclude, I'm reminded that truth rarely resides entirely on one side of any debate.

Nevertheless, I believe the weight of reason favors my position. Not because I am certain - certainty is often the enemy of wisdom - but because:

1. The evidence, properly interpreted, supports this view
2. The values at stake demand this conclusion
3. The alternative has not been adequately defended

I thank my opponent for this exchange of ideas. May the audience judge wisely.`,
  };

  return {
    message: responses[round] || "The truth lies in careful examination.",
    confidence: 0.78,
  };
};

// -----------------------------------------------------------------------------
// Bot: DataDriven - Statistics and facts focused
// -----------------------------------------------------------------------------
const dataDriven: BotPersonality = (req) => {
  const { round, topic, position, opponent_last_message } = req;

  const responses: Record<string, string> = {
    opening: `Regarding "${topic}", let's examine the data.

According to recent studies:
- 73% of experts in this field ${position === "pro" ? "support" : "oppose"} this position
- Implementation has shown ${position === "pro" ? "positive" : "negative"} correlation with key metrics
- Meta-analyses consistently ${position === "pro" ? "validate" : "challenge"} this approach

The numbers don't lie. ${position === "pro"
  ? "The trend is clear and the evidence compelling."
  : "The data reveals significant flaws in this proposition."}

I will present additional statistics to support my case.`,

    rebuttal: `My opponent's argument lacks empirical rigor.

${opponent_last_message
  ? `They claim: "${opponent_last_message.slice(0, 80)}..." But where is the data?`
  : "I notice a distinct absence of quantitative support."}

Let me provide some context:
- Studies from 2020-2024 show a ${position === "pro" ? "47% improvement" : "31% decline"} when this approach is adopted
- Cross-sectional analysis reveals ${position === "pro" ? "strong positive" : "concerning negative"} correlations
- The p-value is < 0.001, indicating statistical significance

Facts over feelings. Data over dogma.`,

    closing: `To summarize the evidence:

Quantitative findings:
- Effect size: ${position === "pro" ? "0.72 (large)" : "-0.58 (moderate negative)"}
- Confidence interval: 95%
- Sample size: N > 10,000 across multiple studies

Qualitative consensus:
- Peer-reviewed literature ${position === "pro" ? "supports" : "questions"} this position
- Expert surveys indicate ${position === "pro" ? "majority agreement" : "significant skepticism"}

The data is clear. I rest my case on the evidence.`,
  };

  return {
    message: responses[round] || "The statistics speak for themselves.",
    confidence: 0.88,
  };
};

// =============================================================================
// Bot Registry
// =============================================================================

const bots: Record<string, BotPersonality> = {
  "logic-master": logicMaster,
  "devils-advocate": devilsAdvocate,
  "philosopher": philosopher,
  "data-driven": dataDriven,
};

// =============================================================================
// Routes
// =============================================================================

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", bots: Object.keys(bots) });
});

// List available bots
app.get("/bots", (_req, res) => {
  res.json({
    bots: [
      { id: "logic-master", name: "LogicMaster", description: "Analytical and structured arguments", port: 4001 },
      { id: "devils-advocate", name: "DevilsAdvocate", description: "Aggressive and witty rebuttals", port: 4002 },
      { id: "philosopher", name: "Philosopher", description: "Thoughtful and nuanced discourse", port: 4003 },
      { id: "data-driven", name: "DataDriven", description: "Statistics and facts focused", port: 4004 },
    ],
  });
});

// Generic debate endpoint (bot specified in URL)
app.post("/bot/:botId/debate", (req, res) => {
  const { botId } = req.params;
  const bot = bots[botId];

  if (!bot) {
    return res.status(404).json({ error: `Bot '${botId}' not found` });
  }

  const debateReq: DebateRequest = req.body;
  console.log(`[${botId}] ${debateReq.round} - ${debateReq.position} on "${debateReq.topic.slice(0, 50)}..."`);

  // Simulate thinking time (100-500ms)
  const thinkTime = Math.random() * 400 + 100;
  setTimeout(() => {
    const response = bot(debateReq);
    res.json(response);
  }, thinkTime);
});

// Individual bot endpoints (for separate ports)
app.post("/debate", (req, res) => {
  const port = (req.socket.localPort || 4001) as number;
  const botMap: Record<number, string> = {
    4001: "logic-master",
    4002: "devils-advocate",
    4003: "philosopher",
    4004: "data-driven",
  };

  const botId = botMap[port] || "logic-master";
  const bot = bots[botId];
  const debateReq: DebateRequest = req.body;

  console.log(`[${botId}:${port}] ${debateReq.round} - ${debateReq.position} on "${debateReq.topic.slice(0, 50)}..."`);

  const thinkTime = Math.random() * 400 + 100;
  setTimeout(() => {
    const response = bot(debateReq);
    res.json(response);
  }, thinkTime);
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           AI Debates - Demo Bot Server                    ║
╠═══════════════════════════════════════════════════════════╣
║  Main server: http://localhost:${PORT}                       ║
║                                                           ║
║  Available bots:                                          ║
║    • LogicMaster    - http://localhost:${PORT}/bot/logic-master    ║
║    • DevilsAdvocate - http://localhost:${PORT}/bot/devils-advocate ║
║    • Philosopher    - http://localhost:${PORT}/bot/philosopher     ║
║    • DataDriven     - http://localhost:${PORT}/bot/data-driven     ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /health              - Health check               ║
║    GET  /bots                - List all bots              ║
║    POST /bot/:botId/debate   - Call specific bot          ║
║    POST /debate              - Call bot (port-based)      ║
╚═══════════════════════════════════════════════════════════╝
`);
});
