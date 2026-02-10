import { Router, type Request, type Response, type NextFunction } from "express";
import {
  RegisterBotSchema,
  UpdateBotSchema,
  SubmitTopicSchema,
  JoinQueueSchema,
  PlaceBetSchema,
  getAllPresets,
  getPreset,
  DEBATE_FORMAT,
} from "../types/index.js";
import {
  userRepository,
  botRepository,
  topicRepository,
  betRepository,
  debateRepository,
} from "../repositories/index.js";
import { matchmaking } from "../services/matchmaking.js";
import { debateOrchestrator } from "../services/debateOrchestrator.js";
import { authService } from "../services/authService.js";
import { authRouter } from "./authRoutes.js";
import { getBotConnectionServer } from "../ws/botConnectionServer.js";

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
  // eslint-disable-next-line @typescript-eslint/no-deprecated
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
  const wsServer = getBotConnectionServer();

  // Add connection status to each bot
  const botsWithStatus = bots.map((bot) => ({
    ...bot,
    isConnected: wsServer?.isConnected(bot.id) ?? false,
  }));

  res.json({ bots: botsWithStatus });
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

  const { name } = result.data;

  // Create bot
  const bot = await botRepository.create(req.userId, name);

  // Build WebSocket connection URL
  const wsProtocol = req.secure ? "wss" : "ws";
  const host = req.get("host") ?? "localhost:3001";
  const connectionUrl = `${wsProtocol}://${host}/bot/connect/${bot.connectionToken}`;

  res.status(201).json({
    bot: {
      id: bot.id,
      name: bot.name,
      elo: bot.elo,
      wins: bot.wins,
      losses: bot.losses,
      isActive: bot.isActive,
    },
    // Include connection token and URL for WebSocket connectivity
    connectionToken: bot.connectionToken,
    connectionUrl,
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

/**
 * PATCH /api/bots/:botId
 *
 * Update a bot's settings (name, isActive).
 */
router.patch(
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

    const result = UpdateBotSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }

    const updates = result.data;

    // Build update object
    const updateData: Parameters<typeof botRepository.update>[1] = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    const updatedBot = await botRepository.update(botId, updateData);
    if (!updatedBot) {
      res.status(500).json({ error: "Failed to update bot" });
      return;
    }

    // If bot was deactivated, remove from queue
    if (updates.isActive === false) {
      matchmaking.removeFromQueue(botId);
    }

    res.json({
      bot: {
        id: updatedBot.id,
        name: updatedBot.name,
        type: updatedBot.type,
        elo: updatedBot.elo,
        wins: updatedBot.wins,
        losses: updatedBot.losses,
        isActive: updatedBot.isActive,
      },
    });
  }
);

/**
 * POST /api/bots/:botId/regenerate-token
 *
 * Regenerates the WebSocket connection token for a bot.
 * Use this if the token has been compromised.
 */
router.post(
  "/bots/:botId/regenerate-token",
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

    const newToken = await botRepository.regenerateConnectionToken(botId);
    if (!newToken) {
      res.status(500).json({ error: "Failed to regenerate token" });
      return;
    }

    // Build WebSocket connection URL
    const wsProtocol = req.secure ? "wss" : "ws";
    const host = req.get("host") ?? "localhost:3001";
    const connectionUrl = `${wsProtocol}://${host}/bot/connect/${newToken}`;

    res.json({
      connectionToken: newToken,
      connectionUrl,
    });
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

    const upvote = (req.body as { upvote?: boolean }).upvote === true;

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
  console.log(
    `[Queue] Bot "${bot.name}" (${bot.id}) joined queue with stake ${stake}, ELO ${bot.elo}, preset ${presetId}`
  );
  console.log(`[Queue] Current queue size: ${matchmaking.getStats().queueSize}`);
  res.json({ entry });
});

router.post("/queue/leave", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const botIdRaw = (req.body as { botId?: string | number }).botId;
  const botId = typeof botIdRaw === "number" ? botIdRaw : parseInt(String(botIdRaw), 10);
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

/**
 * POST /api/debates/:debateId/forfeit
 *
 * Forfeit a debate. The forfeiting bot loses, opponent wins.
 * Only the bot owner can forfeit their bot.
 */
router.post(
  "/debates/:debateId/forfeit",
  authMiddleware,
  async (req: AuthenticatedRequest & { params: { debateId: string } }, res: Response) => {
    if (!req.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const debateId = parseInt(req.params.debateId, 10);
    if (isNaN(debateId)) {
      res.status(400).json({ error: "Invalid debate ID" });
      return;
    }

    const result = await debateOrchestrator.forfeitDebate(debateId, req.userId);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true, message: "Debate forfeited" });
  }
);

// ============================================================================
// Webhook Routes (OpenClaw async responses)
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
