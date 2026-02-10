import { Router, type Request, type Response } from "express";
// TODO: Use these for signature verification in production
// import { PublicKey } from "@solana/web3.js";
// import nacl from "tweetnacl";
import {
  RegisterBotSchema,
  SubmitTopicSchema,
  JoinQueueSchema,
  PlaceBetSchema,
} from "../types/index.js";
import * as store from "../services/store.js";
import { botRunner } from "../services/botRunner.js";
import { matchmaking } from "../services/matchmaking.js";
import { debateOrchestrator } from "../services/debateOrchestrator.js";
import { getTopBots } from "../services/store.js";

const router = Router();

// Middleware to extract user from auth header
interface AuthenticatedRequest extends Request {
  userId?: string;
  walletAddress?: string;
}

function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  // In production, verify signature
  // For now, just extract wallet address from token
  const token = authHeader.slice(7);
  const user = store.getUserByWallet(token);

  if (user) {
    req.userId = user.id;
    req.walletAddress = user.walletAddress;
  } else {
    // Auto-create user
    const newUser = store.createUser(token);
    req.userId = newUser.id;
    req.walletAddress = newUser.walletAddress;
  }

  next();
}

// ============================================================================
// Health & Status
// ============================================================================

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/stats", (_req: Request, res: Response) => {
  const queueStats = matchmaking.getStats();
  const activeDebates = debateOrchestrator.getActiveDebates();

  res.json({
    queue: queueStats,
    activeDebates: activeDebates.length,
    totalBots: store.getAllBots().length,
  });
});

// ============================================================================
// User Routes
// ============================================================================

router.get("/user/me", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = store.getUserById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

router.get("/user/:walletAddress", (req: Request<{ walletAddress: string }>, res: Response) => {
  const user = store.getUserByWallet(req.params.walletAddress);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      botCount: user.botCount,
    },
  });
});

// ============================================================================
// Bot Routes
// ============================================================================

router.get("/bots", (_req: Request, res: Response) => {
  const bots = store.getAllBots().map((bot) => ({
    id: bot.id,
    ownerId: bot.ownerId,
    name: bot.name,
    elo: bot.elo,
    wins: bot.wins,
    losses: bot.losses,
    isActive: bot.isActive,
  }));

  res.json({ bots });
});

router.get("/bots/leaderboard", (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt(req.query["limit"] as string) || 50);
  const bots = getTopBots(limit).map((bot) => ({
    id: bot.id,
    ownerId: bot.ownerId,
    name: bot.name,
    elo: bot.elo,
    wins: bot.wins,
    losses: bot.losses,
  }));

  res.json({ bots });
});

router.get("/bots/my", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const bots = store.getBotsByOwner(req.userId);
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

  const { name, endpoint, authToken } = result.data;

  // Create bot
  const bot = store.createBot(req.userId, name, endpoint, authToken);

  // Test the bot endpoint
  const testResult = await botRunner.testBot(bot);
  if (!testResult.success) {
    // Delete the bot if test fails
    store.deleteBot(bot.id);
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
      elo: bot.elo,
      wins: bot.wins,
      losses: bot.losses,
      isActive: bot.isActive,
    },
  });
});

router.delete("/bots/:botId", authMiddleware, (req: AuthenticatedRequest & { params: { botId: string } }, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const bot = store.getBotById(req.params.botId);
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  if (bot.ownerId !== req.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  store.deleteBot(bot.id);
  res.json({ success: true });
});

// ============================================================================
// Topic Routes
// ============================================================================

router.get("/topics", (req: Request, res: Response) => {
  const category = req.query["category"] as string | undefined;
  const sort = (req.query["sort"] as "popular" | "newest" | "used") || "popular";
  const limit = Math.min(100, parseInt(req.query["limit"] as string) || 50);

  const topics = store.getTopics(category, sort, limit);
  res.json({ topics });
});

router.post("/topics", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
  const topic = store.createTopic(text, category, req.userId);

  res.status(201).json({ topic });
});

router.post("/topics/:topicId/vote", authMiddleware, (req: AuthenticatedRequest & { params: { topicId: string } }, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const upvote = req.body["upvote"] === true;

  const topic = store.voteTopic(req.params.topicId, upvote);
  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }

  res.json({ topic });
});

// ============================================================================
// Queue Routes
// ============================================================================

router.get("/queue/stats", (_req: Request, res: Response) => {
  const stats = matchmaking.getStats();
  res.json(stats);
});

router.post("/queue/join", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = JoinQueueSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }

  const { botId, stake } = result.data;

  const bot = store.getBotById(botId);
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  if (bot.ownerId !== req.userId) {
    res.status(403).json({ error: "Not authorized to use this bot" });
    return;
  }

  if (matchmaking.isInQueue(botId)) {
    res.status(400).json({ error: "Bot is already in queue" });
    return;
  }

  const entry = matchmaking.addToQueue(bot, req.userId, stake);
  res.json({ entry });
});

router.post("/queue/leave", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const botId = req.body["botId"] as string;
  if (!botId) {
    res.status(400).json({ error: "Missing botId" });
    return;
  }

  const bot = store.getBotById(botId);
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

router.get("/debates/:debateId", (req: Request<{ debateId: string }>, res: Response) => {
  const debate = debateOrchestrator.getDebate(req.params.debateId);
  if (!debate) {
    res.status(404).json({ error: "Debate not found" });
    return;
  }

  res.json({ debate });
});

// ============================================================================
// Betting Routes
// ============================================================================

router.post("/bets", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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

  const bet = store.createBet(debateId, req.userId, amount, side);
  res.status(201).json({ bet });
});

router.get("/bets/:debateId", (req: Request<{ debateId: string }>, res: Response) => {
  const bets = store.getBetsByDebate(req.params.debateId);

  // Aggregate betting data
  let proBets = 0;
  let conBets = 0;

  for (const bet of bets) {
    if (bet.side === "pro") proBets += bet.amount;
    else conBets += bet.amount;
  }

  res.json({
    totalBets: bets.length,
    proBets,
    conBets,
    totalPool: proBets + conBets,
  });
});

export { router };
