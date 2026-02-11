import Redis from "ioredis";
import { createLogger } from "@x1-labs/logging";

const logger = createLogger({ name: "redis" });

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

// Main Redis client for commands
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error("Max retries reached, giving up");
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

// Subscriber client for pub/sub (separate connection required)
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// Publisher client for pub/sub
export const redisPub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// Connection event handlers
redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error({ err: err.message }, "Redis error"));
redis.on("reconnecting", () => logger.info("Redis reconnecting..."));

redisSub.on("connect", () => logger.info("Redis subscriber connected"));
redisSub.on("error", (err) => logger.error({ err: err.message }, "Redis subscriber error"));
redisSub.on("subscribe", (channel, count) => logger.debug({ channel, count }, "Subscribed to channel"));
redisSub.on("message", (channel) => logger.trace({ channel }, "Message received on channel"));

redisPub.on("connect", () => logger.info("Redis publisher connected"));
redisPub.on("error", (err) => logger.error({ err: err.message }, "Redis publisher error"));

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisSub.quit(), redisPub.quit()]);
}

// Check if Redis is available
export function isRedisAvailable(): boolean {
  return redis.status === "ready";
}

// Redis key prefixes
export const KEYS = {
  // Matchmaking
  QUEUE: "matchmaking:queue", // ZSET sorted by join time
  QUEUE_ENTRY: (id: string) => `matchmaking:entry:${id}`, // HASH for entry data
  BOT_TO_ENTRY: "matchmaking:bot_to_entry", // HASH botId -> entryId

  // Bot connections
  BOT_CONNECTED: (botId: number) => `bot:connected:${botId}`, // STRING with instance ID
  BOT_INSTANCE: (instanceId: string) => `bot:instance:${instanceId}`, // SET of connected bot IDs

  // Debate broadcasts
  DEBATE_SPECTATOR_COUNT: (debateId: number) => `debate:spectators:${debateId}`, // STRING counter

  // Pub/sub channels
  CHANNEL_DEBATE_BROADCAST: (debateId: number) => `channel:debate:${debateId}`,
  CHANNEL_BOT_REQUEST: (botId: number) => `channel:bot:request:${botId}`,
  CHANNEL_BOT_RESPONSE: (requestId: string) => `channel:bot:response:${requestId}`,
} as const;

// Instance ID for this server (used for bot connection routing)
export const INSTANCE_ID = `${process.env["HOSTNAME"] ?? "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
