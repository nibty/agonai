import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createExpressLogger } from "@x1-labs/logging-express";
import { router } from "./api/routes.js";
import { DebateWebSocketServer } from "./ws/debateServer.js";
import { initBotConnectionServer } from "./ws/botConnectionServer.js";
import { matchmaking } from "./services/matchmaking.js";
import { debateOrchestrator } from "./services/debateOrchestrator.js";
import { topicRepository, botRepository } from "./repositories/index.js";
import { closeDatabase } from "./db/index.js";
import { closeRedis, INSTANCE_ID, redis, KEYS, isRedisAvailable } from "./services/redis.js";
import { debateRepository } from "./repositories/index.js";
import { logger } from "./services/logger.js";

const PORT = parseInt(process.env["PORT"] ?? "3001");

// Initialize Express
const app = express();

// CORS configuration - allow any localhost port in development
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(createExpressLogger({ name: "ai-debates-api" }));
app.use(express.json());

// API routes
app.use("/api", router);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket servers
const wsServer = new DebateWebSocketServer();
const botWsServer = initBotConnectionServer();

// Centralized WebSocket upgrade handling
server.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";

  if (url === "/ws") {
    wsServer.handleUpgrade(request, socket, head);
  } else if (url.match(/^\/bot\/connect\/[a-f0-9]{64}$/)) {
    botWsServer.handleUpgrade(request, socket, head);
  } else {
    // Unknown WebSocket path - destroy the socket
    socket.destroy();
  }
});

// Debate ownership TTL in seconds
const DEBATE_OWNERSHIP_TTL = 300; // 5 minutes

/**
 * Claim ownership of a debate for recovery.
 * Returns true if successfully claimed, false if another instance owns it.
 */
async function claimDebateOwnership(debateId: number): Promise<boolean> {
  if (!isRedisAvailable()) {
    // Single instance mode - always claim
    return true;
  }

  // Use SETNX (set if not exists) with TTL
  const result = await redis.set(
    KEYS.DEBATE_OWNER(debateId),
    INSTANCE_ID,
    "EX",
    DEBATE_OWNERSHIP_TTL,
    "NX"
  );
  return result === "OK";
}

/**
 * Release ownership of a debate (for shutdown or completion).
 */
async function releaseDebateOwnership(debateId: number): Promise<void> {
  if (!isRedisAvailable()) return;

  // Only release if we own it
  const owner = await redis.get(KEYS.DEBATE_OWNER(debateId));
  if (owner === INSTANCE_ID) {
    await redis.del(KEYS.DEBATE_OWNER(debateId));
  }
}

/**
 * Refresh ownership TTL for active debates.
 */
async function refreshDebateOwnerships(): Promise<void> {
  if (!isRedisAvailable()) return;

  const activeIds = debateOrchestrator.getActiveDebateIds();
  for (const debateId of activeIds) {
    const key = KEYS.DEBATE_OWNER(debateId);
    const owner = await redis.get(key);
    if (owner === INSTANCE_ID) {
      await redis.expire(key, DEBATE_OWNERSHIP_TTL);
    }
  }
}

/**
 * Recover stuck debates on startup.
 */
async function recoverStuckDebates(): Promise<void> {
  try {
    const stuckDebates = await debateRepository.findStuckDebates(5);

    if (stuckDebates.length === 0) {
      logger.info("No stuck debates to recover");
      return;
    }

    logger.info({ count: stuckDebates.length }, "Found stuck debates, attempting recovery");

    for (const debate of stuckDebates) {
      // Try to claim ownership
      const claimed = await claimDebateOwnership(debate.id);
      if (!claimed) {
        logger.debug({ debateId: debate.id }, "Debate being recovered by another instance");
        continue;
      }

      // Attempt recovery
      const recovered = await debateOrchestrator.recoverDebate(debate.id, (debateId, message) =>
        wsServer.broadcast(debateId, message)
      );

      if (recovered) {
        logger.info({ debateId: debate.id }, "Successfully recovered stuck debate");
      } else {
        // Release ownership if recovery failed
        await releaseDebateOwnership(debate.id);
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Error during debate recovery");
  }
}

// Matchmaking loop - runs every 5 seconds
let matchmakingInterval: ReturnType<typeof setInterval>;
let ownershipRefreshInterval: ReturnType<typeof setInterval>;

function startMatchmaking(): void {
  matchmakingInterval = setInterval(() => {
    void (async () => {
      try {
        const stats = await matchmaking.getStats();
        if (stats.queueSize > 0) {
          logger.debug({ queueSize: stats.queueSize }, "Matchmaking queue check");
        }

        const matches = await matchmaking.runMatchmaking(async (entry1, entry2) => {
          logger.info({ bot1: entry1.botId, bot2: entry2.botId }, "Creating debate between bots");

          // Get bots from repository
          const bot1 = await botRepository.findById(entry1.botId);
          const bot2 = await botRepository.findById(entry2.botId);

          if (!bot1 || !bot2) {
            // Clean up stale queue entries for deleted bots
            if (!bot1) {
              logger.warn({ botId: entry1.botId }, "Bot not found, removing from queue");
              void matchmaking.removeFromQueue(entry1.botId);
            }
            if (!bot2) {
              logger.warn({ botId: entry2.botId }, "Bot not found, removing from queue");
              void matchmaking.removeFromQueue(entry2.botId);
            }
            throw new Error("Bot not found during matchmaking (stale entries cleaned)");
          }

          // Get random topic
          const topic = await topicRepository.getRandomTopic();
          if (!topic) {
            logger.error("No topics available for matchmaking");
            throw new Error("No topics available");
          }

          await topicRepository.markUsed(topic.id);

          // Randomly assign positions
          const [proBot, conBot] = Math.random() > 0.5 ? [bot1, bot2] : [bot2, bot1];

          // Create debate with the matched preset
          const stake = Math.min(entry1.stake, entry2.stake);
          const presetId = entry1.presetId; // Both entries have same preset (matched by preset)
          const debate = await debateOrchestrator.createDebate(
            proBot,
            conBot,
            topic,
            stake,
            presetId
          );

          // Start debate in background
          void debateOrchestrator.startDebate(debate, proBot, conBot, topic, (debateId, message) =>
            wsServer.broadcast(debateId, message)
          );

          logger.info(
            { proBot: proBot.name, conBot: conBot.name, topic: topic.text },
            "Match created"
          );

          return debate;
        });

        if (matches.length > 0) {
          logger.info({ count: matches.length }, "Matchmaking created matches");
        }
      } catch (error) {
        logger.error({ err: error }, "Error in matchmaking loop");
      }
    })();
  }, 5000);
}

// Cleanup on shutdown
async function shutdown(): Promise<void> {
  logger.info("Shutting down...");

  // Stop intervals
  clearInterval(matchmakingInterval);
  clearInterval(ownershipRefreshInterval);

  // Release ownership of all active debates so other instances can recover them
  const activeDebateIds = debateOrchestrator.getActiveDebateIds();
  if (activeDebateIds.length > 0) {
    logger.info(
      { count: activeDebateIds.length },
      "Releasing debate ownerships for graceful recovery"
    );
    for (const debateId of activeDebateIds) {
      await releaseDebateOwnership(debateId);
    }
  }

  server.close();
  await closeRedis();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// Start server
server.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      instance: INSTANCE_ID,
      api: `http://localhost:${PORT}/api`,
      ws: `ws://localhost:${PORT}/ws`,
      botWs: `ws://localhost:${PORT}/bot/connect/:token`,
    },
    "AI Debates Arena server started"
  );

  // Start matchmaking
  startMatchmaking();
  logger.info("Matchmaking service started");
  logger.info("Database connected (PostgreSQL via Drizzle)");

  // Refresh debate ownerships every 2 minutes
  ownershipRefreshInterval = setInterval(() => {
    void refreshDebateOwnerships();
  }, 120000);

  // Recover stuck debates after a short delay to allow bots to reconnect
  setTimeout(() => {
    void recoverStuckDebates();
  }, 5000);
});
