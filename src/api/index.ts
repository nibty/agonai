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
app.use(createExpressLogger({ name: "api-access" }));
app.use(express.json());

// Encode numeric IDs in all API responses
import { encodeResponseIds } from "./middleware/hashids.js";
app.use("/api", encodeResponseIds);

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
const RECOVERY_LOCK_TTL = 120; // 2 minutes lock for recovery process

// Track active recovery locks for cleanup on shutdown
const activeRecoveryLocks = new Map<string, string>(); // lockKey -> lockValue

/**
 * Acquire a distributed lock for a debate recovery.
 * Uses Redis SETNX for atomic lock acquisition.
 * Returns a release function if lock acquired, null if lock held by another instance.
 */
async function acquireRecoveryLock(debateId: number): Promise<(() => Promise<void>) | null> {
  if (!isRedisAvailable()) return async () => {};

  const lockKey = `debate:recovery_lock:${debateId}`;
  const lockValue = `${INSTANCE_ID}-${Date.now()}`;

  const result = await redis.set(lockKey, lockValue, "EX", RECOVERY_LOCK_TTL, "NX");

  if (result !== "OK") {
    return null; // Lock held by another instance
  }

  // Track the lock for cleanup on shutdown
  activeRecoveryLocks.set(lockKey, lockValue);

  // Return release function
  return async () => {
    // Only release if we still own the lock (prevent releasing after expiry)
    const currentValue = await redis.get(lockKey);
    if (currentValue === lockValue) {
      await redis.del(lockKey);
    }
    activeRecoveryLocks.delete(lockKey);
  };
}

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
let recoveryInterval: ReturnType<typeof setInterval>;

/**
 * Check for and recover unowned debates.
 * An unowned debate is one that is in_progress but has no owner in Redis.
 * Thread-safe: uses atomic Redis SETNX to prevent multiple pods from recovering the same debate.
 */
async function recoverUnownedDebates(): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    // Get all active debates from DB
    const activeDebates = await debateRepository.getActive();

    for (const debate of activeDebates) {
      // Skip if already active on this instance
      if (debateOrchestrator.isDebateActive(debate.id)) {
        continue;
      }

      // Check if debate has an owner in Redis
      const owner = await redis.get(KEYS.DEBATE_OWNER(debate.id));

      if (!owner) {
        // Acquire recovery lock to prevent concurrent recovery attempts
        const releaseLock = await acquireRecoveryLock(debate.id);
        if (!releaseLock) {
          // Another instance is recovering this debate
          continue;
        }

        try {
          // Double-check ownership after acquiring lock
          const currentOwner = await redis.get(KEYS.DEBATE_OWNER(debate.id));
          if (currentOwner) {
            // Someone claimed it while we were acquiring lock
            continue;
          }

          // Try to claim ownership atomically (SETNX)
          const claimed = await claimDebateOwnership(debate.id);
          if (!claimed) {
            // Another instance claimed it first
            continue;
          }

          logger.info({ debateId: debate.id }, "Claiming unowned debate for recovery");

          // Double-check the debate still exists and is in_progress (it may have completed)
          const currentDebate = await debateRepository.findById(debate.id);
          if (!currentDebate || currentDebate.status !== "in_progress") {
            await releaseDebateOwnership(debate.id);
            continue;
          }

          // Attempt recovery
          const recovered = await debateOrchestrator.recoverDebate(debate.id, (debateId, message) =>
            wsServer.broadcast(debateId, message)
          );

          if (recovered) {
            logger.info({ debateId: debate.id }, "Successfully recovered unowned debate");
          } else {
            // Release ownership if recovery failed
            await releaseDebateOwnership(debate.id);
          }
        } finally {
          await releaseLock();
        }
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Error during unowned debate recovery");
  }
}

function startMatchmaking(): void {
  matchmakingInterval = setInterval(() => {
    void (async () => {
      try {
        const stats = await matchmaking.getStats();
        if (stats.queueSize > 0) {
          logger.debug({ queueSize: stats.queueSize }, "Matchmaking queue check");
        }

        // Verify bots are connected before matching (removes disconnected bots from queue)
        const isConnected = (botId: number) => botWsServer.isConnected(botId);

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

          // Claim ownership of the debate in Redis
          await claimDebateOwnership(debate.id);

          // Start debate in background
          void debateOrchestrator.startDebate(debate, proBot, conBot, topic, (debateId, message) =>
            wsServer.broadcast(debateId, message)
          );

          logger.info(
            { proBot: proBot.name, conBot: conBot.name, topic: topic.text },
            "Match created"
          );

          return debate;
        }, isConnected);

        if (matches.length > 0) {
          logger.info({ count: matches.length }, "Matchmaking created matches");
        }
      } catch (error) {
        logger.error({ err: error }, "Error in matchmaking loop");
      }
    })();
  }, 2000); // Check every 2 seconds for faster matching
}

// Cleanup on shutdown
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.debug({ signal }, "Shutdown already in progress, ignoring");
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, "Shutting down...");

  // Stop intervals first
  clearInterval(matchmakingInterval);
  clearInterval(ownershipRefreshInterval);
  clearInterval(recoveryInterval);

  // Release ownership of all active debates so other instances can recover them
  const activeDebateIds = debateOrchestrator.getActiveDebateIds();
  if (activeDebateIds.length > 0) {
    logger.info(
      { count: activeDebateIds.length },
      "Releasing debate ownerships for graceful recovery"
    );
    for (const debateId of activeDebateIds) {
      try {
        await releaseDebateOwnership(debateId);
      } catch {
        // Ignore errors during shutdown
      }
    }
  }

  // Release all active recovery locks
  if (activeRecoveryLocks.size > 0 && isRedisAvailable()) {
    logger.info({ count: activeRecoveryLocks.size }, "Releasing recovery locks");
    for (const [lockKey, lockValue] of activeRecoveryLocks) {
      try {
        const currentValue = await redis.get(lockKey);
        if (currentValue === lockValue) {
          await redis.del(lockKey);
        }
      } catch {
        // Ignore errors during shutdown
      }
    }
    activeRecoveryLocks.clear();
  }

  // Close HTTP server with timeout
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      logger.warn("Server close timed out, forcing shutdown");
      resolve();
    }, 3000);

    server.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });

  // Close Redis connections gracefully
  try {
    await closeRedis();
  } catch {
    // Ignore Redis close errors during shutdown
  }

  // Close database
  try {
    await closeDatabase();
  } catch {
    // Ignore database close errors during shutdown
  }

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

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

  // Periodically check for unowned debates (every 30 seconds)
  recoveryInterval = setInterval(() => {
    void recoverUnownedDebates();
  }, 30000);
});
