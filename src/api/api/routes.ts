import { Router, type Request, type Response, type NextFunction } from "express";
import {
  RegisterBotSchema,
  SubmitTopicSchema,
  JoinQueueSchema,
  PlaceBetSchema,
  DEBATE_FORMAT,
  getAllPresets,
  getPreset,
} from "../types/index.js";
import {
  userRepository,
  botRepository,
  topicRepository,
  betRepository,
  debateRepository,
} from "../repositories/index.js";
import { botRunner } from "../services/botRunner.js";
import { matchmaking } from "../services/matchmaking.js";
import { debateOrchestrator } from "../services/debateOrchestrator.js";
import { authService } from "../services/authService.js";
import { authRouter } from "./authRoutes.js";
import { handleOpenClawWebhook } from "../services/openclawService.js";

const router = Router();

// ============================================================================
// Auth Middleware
// ============================================================================

interface AuthenticatedRequest extends Request {
  userId?: number;
  walletAddress?: string;
}

async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = payload.userId;
  req.walletAddress = payload.walletAddress;

  next();
}

// Mount auth routes
router.use("/auth", authRouter);

// ============================================================================
// Health & Status
// ============================================================================

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /api/debate-format
 *
 * Returns the debate format specification including timing, word limits, and rules.
 * @deprecated Use /api/presets instead for configurable formats
 */
router.get("/debate-format", (_req: Request, res: Response) => {
  res.json(DEBATE_FORMAT);
});

/**
 * GET /api/presets
 *
 * Returns all available debate presets with their configurations.
 */
router.get("/presets", (_req: Request, res: Response) => {
  const presets = getAllPresets();
  res.json({ presets });
});

/**
 * GET /api/presets/:presetId
 *
 * Returns a specific debate preset by ID.
 */
router.get("/presets/:presetId", (req: Request<{ presetId: string }>, res: Response) => {
  const preset = getPreset(req.params.presetId);
  if (!preset) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  res.json({ preset });
});

router.get("/stats", async (_req: Request, res: Response) => {
  const queueStats = matchmaking.getStats();
  const activeDebates = debateOrchestrator.getActiveDebates();
  const allBots = await botRepository.getAll();

  res.json({
    queue: queueStats,
    activeDebates: activeDebates.length,
    totalBots: allBots.length,
  });
});

// ============================================================================
// User Routes
// ============================================================================

router.get("/user/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await userRepository.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const botCount = await botRepository.countByOwner(req.userId);

  res.json({
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      botCount,
      createdAt: user.createdAt,
    },
  });
});

router.get(
  "/user/:walletAddress",
  async (req: Request<{ walletAddress: string }>, res: Response) => {
    const user = await userRepository.findByWallet(req.params.walletAddress);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const botCount = await botRepository.countByOwner(user.id);

    res.json({
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        botCount,
      },
    });
  }
);

// ============================================================================
// Bot Routes
// ============================================================================

router.get("/bots", async (_req: Request, res: Response) => {
  const bots = await botRepository.getAll();
  res.json({ bots });
});

router.get("/bots/leaderboard", async (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt(req.query["limit"] as string) || 50);
  const bots = await botRepository.getLeaderboard(limit);
  res.json({ bots });
});

router.get("/bots/my", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const bots = await botRepository.findByOwner(req.userId);
  res.json({ bots });
});

router.post("/bots", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = RegisterBotSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { name, endpoint, authToken, type } = result.data;

  // Create bot with type
  const bot = await botRepository.create(req.userId, name, endpoint, authToken, type);

  // Test the bot endpoint (include auth token for signed test request)
  const testResult = await botRunner.testBot({
    id: bot.id,
    type: bot.type as "http" | "openclaw",
    endpoint: bot.endpoint,
    authToken: authToken ?? null,
    authTokenEncrypted: bot.authTokenEncrypted ?? null,
  });
  if (!testResult.success) {
    // Delete the bot if test fails
    await botRepository.delete(bot.id);
    res.status(400).json({
      error: "Bot endpoint test failed",
      details: testResult.error,
    });
    return;
  }

  res.status(201).json({
    bot: {
      id: bot.id,
      name: bot.name,
      type: bot.type,
      elo: bot.elo,
      wins: bot.wins,
      losses: bot.losses,
      isActive: bot.isActive,
    },
  });
});

router.delete(
  "/bots/:botId",
  authMiddleware,
  async (req: AuthenticatedRequest & { params: { botId: string } }, res: Response) => {
    if (!req.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const botId = parseInt(req.params.botId, 10);
    if (isNaN(botId)) {
      res.status(400).json({ error: "Invalid bot ID" });
      return;
    }

    const bot = await botRepository.findById(botId);
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    if (bot.ownerId !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // Remove from matchmaking queue if present
    matchmaking.removeFromQueue(bot.id);

    await botRepository.delete(bot.id);
    res.json({ success: true });
  }
);

// ============================================================================
// Topic Routes
// ============================================================================

router.get("/topics", async (req: Request, res: Response) => {
  const category = req.query["category"] as string | undefined;
  const sort = (req.query["sort"] as "popular" | "newest" | "used") || "popular";
  const limit = Math.min(100, parseInt(req.query["limit"] as string) || 50);

  const topics = await topicRepository.getTopics(category, sort, limit);
  res.json({ topics });
});

router.post("/topics", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = SubmitTopicSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { text, category } = result.data;
  const topic = await topicRepository.create({
    text,
    category,
    proposerId: req.userId,
  });

  res.status(201).json({ topic });
});

router.post(
  "/topics/:topicId/vote",
  authMiddleware,
  async (req: AuthenticatedRequest & { params: { topicId: string } }, res: Response) => {
    if (!req.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const topicId = parseInt(req.params.topicId, 10);
    if (isNaN(topicId)) {
      res.status(400).json({ error: "Invalid topic ID" });
      return;
    }

    const upvote = req.body["upvote"] === true;

    const topic = await topicRepository.vote(topicId, req.userId, upvote);
    if (!topic) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }

    res.json({ topic });
  }
);

// ============================================================================
// Queue Routes
// ============================================================================

router.get("/queue/stats", (_req: Request, res: Response) => {
  const stats = matchmaking.getStats();
  res.json(stats);
});

router.post("/queue/join", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = JoinQueueSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { botId, stake, presetId } = result.data;

  const bot = await botRepository.findById(botId);
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  if (bot.ownerId !== req.userId) {
    res.status(403).json({ error: "Not authorized to use this bot" });
    return;
  }

  // addToQueue handles removing any existing entry for this bot
  const entry = matchmaking.addToQueue(bot, req.userId, stake, presetId);
  console.log(`[Queue] Bot "${bot.name}" (${bot.id}) joined queue with stake ${stake}, ELO ${bot.elo}, preset ${presetId}`);
  console.log(`[Queue] Current queue size: ${matchmaking.getStats().queueSize}`);
  res.json({ entry });
});

router.post("/queue/leave", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const botIdRaw = req.body["botId"];
  const botId = typeof botIdRaw === "number" ? botIdRaw : parseInt(botIdRaw, 10);
  if (isNaN(botId)) {
    res.status(400).json({ error: "Missing or invalid botId" });
    return;
  }

  const bot = await botRepository.findById(botId);
  if (!bot || bot.ownerId !== req.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const success = matchmaking.removeFromQueue(botId);
  res.json({ success });
});

// ============================================================================
// Debate Routes
// ============================================================================

router.get("/debates/active", (_req: Request, res: Response) => {
  const debates = debateOrchestrator.getActiveDebates();
  res.json({ debates });
});

router.get("/debates/recent", async (req: Request, res: Response) => {
  const limit = Math.min(50, parseInt(req.query["limit"] as string) || 10);
  const debates = await debateRepository.getRecent(limit);

  // Fetch bot names for each debate
  const debatesWithBots = await Promise.all(
    debates.map(async (debate) => {
      const [proBot, conBot] = await Promise.all([
        debate.proBotId ? botRepository.findById(debate.proBotId) : null,
        debate.conBotId ? botRepository.findById(debate.conBotId) : null,
      ]);
      return {
        ...debate,
        proBotName: proBot?.name ?? "Unknown",
        proBotElo: proBot?.elo ?? 0,
        conBotName: conBot?.name ?? "Unknown",
        conBotElo: conBot?.elo ?? 0,
      };
    })
  );

  res.json({ debates: debatesWithBots });
});

router.get("/debates/:debateId", async (req: Request<{ debateId: string }>, res: Response) => {
  const debateId = parseInt(req.params.debateId, 10);
  if (isNaN(debateId)) {
    res.status(400).json({ error: "Invalid debate ID" });
    return;
  }

  // First check if it's an active debate in the orchestrator
  const activeDebate = debateOrchestrator.getDebate(debateId);
  if (activeDebate) {
    const preset = getPreset(activeDebate.presetId);
    res.json({ debate: activeDebate, preset });
    return;
  }

  // Otherwise, fetch from database (for completed debates)
  const fullDebate = await debateRepository.getFullDebate(debateId);
  if (!fullDebate) {
    res.status(404).json({ error: "Debate not found" });
    return;
  }

  // Fetch related data (bots and topic)
  const [proBot, conBot, topic] = await Promise.all([
    fullDebate.debate.proBotId ? botRepository.findById(fullDebate.debate.proBotId) : null,
    fullDebate.debate.conBotId ? botRepository.findById(fullDebate.debate.conBotId) : null,
    fullDebate.debate.topicId ? topicRepository.findById(fullDebate.debate.topicId) : null,
  ]);

  const preset = getPreset(fullDebate.debate.presetId);

  res.json({
    debate: fullDebate.debate,
    roundResults: fullDebate.roundResults,
    messages: fullDebate.messages,
    proBot,
    conBot,
    topic,
    preset,
  });
});

// ============================================================================
// Webhook Routes (OpenClaw async responses)
// ============================================================================

/**
 * POST /api/webhooks/openclaw
 *
 * Receives async responses from OpenClaw bots.
 * OpenClaw sends responses to this endpoint after processing debate requests.
 */
router.post("/webhooks/openclaw", async (req: Request, res: Response) => {
  try {
    const result = await handleOpenClawWebhook(req.body);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("[OpenClaw Webhook] Error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/test-endpoint
 *
 * Tests a bot endpoint (used by frontend to avoid CORS issues)
 */
router.post("/test-endpoint", async (req: Request, res: Response) => {
  const { endpoint, type, authToken } = req.body as {
    endpoint?: string;
    type?: "http" | "openclaw";
    authToken?: string;
  };

  if (!endpoint) {
    res.status(400).json({ success: false, error: "Missing endpoint" });
    return;
  }

  try {
    if (type === "openclaw") {
      // Test OpenClaw gateway health
      const response = await fetch(`${endpoint}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      res.json({ success: response.ok, error: response.ok ? undefined : `Gateway returned ${response.status}` });
    } else {
      // Test HTTP bot with a test request
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          debate_id: "test",
          round: "opening",
          topic: "This is a test topic to verify your bot is working correctly.",
          position: "pro",
          opponent_last_message: null,
          time_limit_seconds: 60,
          word_limit: { min: 100, max: 300 },
          char_limit: { min: 400, max: 2100 },
          messages_so_far: [],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        res.json({ success: false, error: `Bot returned ${response.status}` });
        return;
      }

      const data = (await response.json()) as { message?: string };
      res.json({ success: !!data.message, error: data.message ? undefined : "No message in response" });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
});

// ============================================================================
// Betting Routes
// ============================================================================

router.post("/bets", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = PlaceBetSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { debateId, side, amount } = result.data;

  const debate = debateOrchestrator.getDebate(debateId);
  if (!debate) {
    res.status(404).json({ error: "Debate not found" });
    return;
  }

  if (debate.status !== "pending") {
    res.status(400).json({ error: "Betting is closed for this debate" });
    return;
  }

  const bet = await betRepository.create({
    debateId,
    bettorId: req.userId,
    amount,
    side,
  });

  res.status(201).json({ bet });
});

router.get("/bets/:debateId", async (req: Request<{ debateId: string }>, res: Response) => {
  const debateId = parseInt(req.params.debateId, 10);
  if (isNaN(debateId)) {
    res.status(400).json({ error: "Invalid debate ID" });
    return;
  }

  const stats = await betRepository.getPoolStats(debateId);
  res.json(stats);
});

export { router };
