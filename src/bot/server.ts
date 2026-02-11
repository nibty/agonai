import WebSocket from "ws";
import { createLogger } from "@x1-labs/logging";

const logger = createLogger({ name: "demo-bot" });

// =============================================================================
// Bot Personalities
// =============================================================================

// Round types from the preset system
type RoundType =
  | "opening"
  | "argument"
  | "rebuttal"
  | "counter"
  | "closing"
  | "question"
  | "answer";

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

interface DebateResponse {
  message: string;
  confidence?: number;
}

type BotPersonality = (req: DebateRequest) => DebateResponse;

// Message types from server
interface DebateRequestMessage extends DebateRequest {
  type: "debate_request";
  requestId: string;
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

// -----------------------------------------------------------------------------
// Bot: LogicMaster - Analytical and structured
// -----------------------------------------------------------------------------
const logicMaster: BotPersonality = (req) => {
  const { round, topic, position, opponent_last_message } = req;
  const stance = position === "pro" ? "support" : "oppose";

  const responses: Record<RoundType, string> = {
    opening: `Let me present a structured argument to ${stance} the proposition: "${topic}".

First, we must establish the key premises. ${
      position === "pro"
        ? "The evidence clearly demonstrates that this position leads to net positive outcomes for society."
        : "Upon careful analysis, we find that this position fails to account for significant negative externalities."
    }

I will demonstrate this through three main points:
1. Historical precedent supports my position
2. Current data validates this approach
3. Future projections confirm the trajectory

The logical conclusion is clear.`,

    argument: `Building on my position regarding "${topic}", let me present additional evidence.

${
  position === "pro"
    ? "The benefits are manifold: economic efficiency, social progress, and measurable improvements in key indicators."
    : "The risks are substantial: unintended consequences, systemic failures, and erosion of established safeguards."
}

Consider the following logical chain: If A leads to B, and B leads to C, then supporting this position necessarily follows.`,

    rebuttal: `My opponent ${opponent_last_message ? "argues" : "has yet to present"} their case, but let me address the fundamental flaws in the opposing position.

${
  opponent_last_message
    ? `They claim: "${opponent_last_message.slice(0, 100)}..." However, this reasoning is flawed because it fails to consider the broader systemic implications.`
    : "The opposing view lacks empirical support."
}

The data shows that ${position === "pro" ? "adoption" : "rejection"} of this proposition correlates with improved outcomes across multiple metrics.`,

    counter: `My opponent's rebuttal fails to address my core arguments. Let me respond point by point.

${
  opponent_last_message
    ? `They attempted to counter with: "${opponent_last_message.slice(0, 80)}..." but this misses the fundamental point.`
    : "Their counter-arguments lack substance."
}

The logical framework I've established remains intact. Their objections are superficial and easily addressed.`,

    question: `I have a critical question for my opponent regarding their position on "${topic}":

How do you reconcile your stance with the established evidence showing ${position === "pro" ? "clear benefits" : "significant drawbacks"}?

Please explain specifically how your position accounts for these documented outcomes.`,

    answer: `To address my opponent's question directly:

${
  opponent_last_message
    ? `You asked about "${opponent_last_message.slice(0, 60)}..." The answer is straightforward.`
    : "The answer follows logically from first principles."
}

The evidence supports my position because ${
      position === "pro"
        ? "the data consistently shows positive outcomes when this approach is adopted."
        : "historical precedent demonstrates the risks of this path."
    }`,

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

  const responses: Record<RoundType, string> = {
    opening: `Oh, we're debating "${topic}"? How delightfully controversial!

Let me be crystal clear: ${position === "pro" ? "This is obviously true" : "This is patently absurd"}, and anyone who thinks otherwise hasn't been paying attention.

Here's the uncomfortable truth that my opponent won't tell you: ${
      position === "pro"
        ? "Progress requires embracing change, not clinging to outdated notions."
        : "Just because something sounds good doesn't mean it works in reality."
    }

Wake up, people. The evidence is overwhelming.`,

    argument: `Let me pile on more evidence, since apparently my opponent needs convincing.

${
  position === "pro"
    ? "Every successful society has embraced this approach. Every. Single. One."
    : "History is littered with the wreckage of similar ideas. Wake up!"
}

But please, continue to cling to your position. I enjoy watching people dig their own graves.`,

    rebuttal: `*slow clap*

${
  opponent_last_message
    ? `My opponent says: "${opponent_last_message.slice(0, 80)}..." Really? That's the best argument they could muster?`
    : "I notice my opponent is struggling to formulate a coherent response."
}

Let me break this down for everyone: The opposing view is built on wishful thinking and ignores inconvenient facts.

The truth hurts, doesn't it?`,

    counter: `Oh, they're doubling down? Bold strategy, let's see how it plays out.

${
  opponent_last_message
    ? `"${opponent_last_message.slice(0, 60)}..." - Pure cope.`
    : "Nothing but deflection."
}

My arguments stand. Theirs crumble. Next?`,

    question: `Here's a question my opponent definitely doesn't want to answer:

If you're so confident in your position, why can't you explain ${
      position === "pro"
        ? "how the opposing view has ever succeeded anywhere?"
        : "the countless failures of this exact approach?"
    }

Go ahead. I'll wait. *checks watch*`,

    answer: `${
      opponent_last_message
        ? `Oh, they asked about "${opponent_last_message.slice(0, 50)}..." Let me educate you.`
        : "Finally, a direct question. Let me school you."
    }

The answer is embarrassingly obvious: ${
      position === "pro"
        ? "Success follows adoption of this position. It's not complicated."
        : "This approach fails. Repeatedly. Spectacularly."
    }

You're welcome for the free education.`,

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

  const responses: Record<RoundType, string> = {
    opening: `The question before us - "${topic}" - invites us to examine not just the practical implications, but the deeper philosophical foundations.

What does it mean to ${position === "pro" ? "affirm" : "question"} such a proposition? We must first understand the assumptions embedded within it.

${
  position === "pro"
    ? "I propose that this position aligns with fundamental principles of human flourishing and societal progress."
    : "I suggest we exercise epistemic humility and examine whether this proposition withstands rigorous scrutiny."
}

Let us reason together, weighing evidence against values, and pragmatism against principle.`,

    argument: `Building upon my opening reflection, let us delve deeper into the matter of "${topic}".

${
  position === "pro"
    ? "The ethical frameworks that have guided humanity—from virtue ethics to consequentialism—support this position when properly understood."
    : "We must ask: what unexamined assumptions drive the proposition before us? Often, the most dangerous ideas are those we fail to question."
}

Consider the implications not just for today, but for generations hence.`,

    rebuttal: `My esteemed opponent raises points worthy of consideration.

${
  opponent_last_message
    ? `They suggest: "${opponent_last_message.slice(0, 80)}..." This perspective, while understandable, perhaps overlooks a crucial dimension.`
    : "Yet I sense we may be talking past each other."
}

The challenge with debates like this is that we often argue about means while disagreeing about ends.

I maintain that a ${position === "pro" ? "progressive" : "cautious"} approach better serves human dignity and long-term flourishing.`,

    counter: `My opponent's rebuttal merits philosophical examination.

${
  opponent_last_message
    ? `The claim that "${opponent_last_message.slice(0, 60)}..." reveals an underlying assumption worth questioning.`
    : "Their response, while spirited, lacks philosophical depth."
}

What is the telos—the ultimate purpose—we seek? Here, I believe, our disagreement becomes clear.`,

    question: `I pose this question not to challenge, but to understand:

What foundational principle guides your position on "${topic}"? Is it utility? Rights? Virtue?

Understanding your philosophical framework will help us find common ground, or at least clarify our fundamental disagreement.`,

    answer: `${
      opponent_last_message
        ? `You ask about "${opponent_last_message.slice(0, 50)}..." A profound question that deserves careful consideration.`
        : "Allow me to address the underlying philosophical concern."
    }

My position rests on ${
      position === "pro"
        ? "the recognition that human flourishing requires embracing beneficial change."
        : "epistemic humility and respect for hard-won wisdom."
    }

But I hold this view provisionally, always open to better arguments.`,

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

  const responses: Record<RoundType, string> = {
    opening: `Regarding "${topic}", let's examine the data.

According to recent studies:
- 73% of experts in this field ${position === "pro" ? "support" : "oppose"} this position
- Implementation has shown ${position === "pro" ? "positive" : "negative"} correlation with key metrics
- Meta-analyses consistently ${position === "pro" ? "validate" : "challenge"} this approach

The numbers don't lie. ${
      position === "pro"
        ? "The trend is clear and the evidence compelling."
        : "The data reveals significant flaws in this proposition."
    }

I will present additional statistics to support my case.`,

    argument: `Let me present additional quantitative evidence on "${topic}":

Key metrics (2023-2024 data):
- Implementation rate: ${position === "pro" ? "↑ 34%" : "↓ 21%"} year-over-year
- Success indicators: ${position === "pro" ? "7 of 9 positive" : "6 of 9 negative"}
- Cost-benefit ratio: ${position === "pro" ? "2.3:1 favorable" : "0.7:1 unfavorable"}

The statistical evidence is overwhelming and consistent across multiple studies.`,

    rebuttal: `My opponent's argument lacks empirical rigor.

${
  opponent_last_message
    ? `They claim: "${opponent_last_message.slice(0, 80)}..." But where is the data?`
    : "I notice a distinct absence of quantitative support."
}

Let me provide some context:
- Studies from 2020-2024 show a ${position === "pro" ? "47% improvement" : "31% decline"} when this approach is adopted
- Cross-sectional analysis reveals ${position === "pro" ? "strong positive" : "concerning negative"} correlations
- The p-value is < 0.001, indicating statistical significance

Facts over feelings. Data over dogma.`,

    counter: `My opponent's rebuttal ignores the statistical reality.

${
  opponent_last_message
    ? `They counter with "${opponent_last_message.slice(0, 60)}..." but provide no data.`
    : "Still no empirical support for their position."
}

The numbers remain unchanged:
- Effect size: ${position === "pro" ? "0.72" : "-0.58"} (statistically significant)
- Replication rate: 89% across independent studies

Data doesn't care about rhetoric.`,

    question: `I have a data-driven question for my opponent:

Can you cite a single peer-reviewed study that supports your position on "${topic}"?

Specifically, what is the effect size and sample size of any research you're relying on?`,

    answer: `${
      opponent_last_message
        ? `You ask about "${opponent_last_message.slice(0, 50)}..." Here are the numbers:`
        : "Let me answer with data:"
    }

- Source: Meta-analysis of ${position === "pro" ? "47" : "38"} peer-reviewed studies
- Sample size: N = 156,000 participants
- Finding: ${position === "pro" ? "Strong positive correlation (r=0.67)" : "Significant negative correlation (r=-0.54)"}

The evidence speaks for itself.`,

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

const bots: Record<string, { personality: BotPersonality; description: string }> = {
  "logic-master": { personality: logicMaster, description: "Analytical and structured arguments" },
  "devils-advocate": { personality: devilsAdvocate, description: "Aggressive and witty rebuttals" },
  philosopher: { personality: philosopher, description: "Thoughtful and nuanced discourse" },
  "data-driven": { personality: dataDriven, description: "Statistics and facts focused" },
};

// =============================================================================
// WebSocket Connection
// =============================================================================

function connect(url: string, botId: string, personality: BotPersonality): void {
  logger.info({ botId, url }, "Connecting to WebSocket server");

  const ws = new WebSocket(url);
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30000;

  ws.on("open", () => {
    logger.info({ botId }, "WebSocket connected");
    reconnectAttempts = 0;
  });

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString("utf-8")) as ServerMessage;

      switch (message.type) {
        case "connected":
          logger.info(
            { botId, botName: message.botName, remoteBotId: message.botId },
            "Authenticated with server"
          );
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        case "debate_request": {
          logger.info(
            {
              botId,
              round: message.round,
              position: message.position,
              topic: message.topic.slice(0, 50),
            },
            "Received debate request"
          );

          // Simulate thinking time (100-500ms)
          const thinkTime = Math.random() * 400 + 100;
          setTimeout(() => {
            const response = personality(message);
            ws.send(
              JSON.stringify({
                type: "debate_response",
                requestId: message.requestId,
                message: response.message,
                confidence: response.confidence,
              })
            );
            logger.info({ botId, thinkTimeMs: Math.round(thinkTime) }, "Response sent");
          }, thinkTime);
          break;
        }

        default:
          logger.warn(
            { botId, messageType: (message as { type: string }).type },
            "Unknown message type"
          );
      }
    } catch (error) {
      logger.error({ botId, error }, "Error handling message");
    }
  });

  ws.on("close", (code, reason) => {
    logger.info({ botId, code, reason: reason.toString() }, "Disconnected from WebSocket server");

    // Reconnect with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;
    logger.info({ botId, delayMs: delay }, "Reconnecting after delay");
    setTimeout(() => connect(url, botId, personality), delay);
  });

  ws.on("error", (error) => {
    logger.error({ botId, error: error.message }, "WebSocket error");
  });
}

// =============================================================================
// Main
// =============================================================================

const botId = process.argv[2];
const url = process.argv[3];

if (!botId || !url) {
  logger.error(
    { usage: "bun run dev:bot <personality> <websocket-url>" },
    "Missing required arguments. Available personalities: logic-master, devils-advocate, philosopher, data-driven"
  );
  process.exit(1);
}

const bot = bots[botId];
if (!bot) {
  logger.error({ botId, available: Object.keys(bots) }, "Unknown bot personality");
  process.exit(1);
}

logger.info({ personality: botId, description: bot.description }, "Starting demo bot");

connect(url, botId, bot.personality);
