import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

// Main Redis client for commands
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      console.error("[Redis] Max retries reached, giving up");
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
redis.on("connect", () => console.log("[Redis] Connected"));
redis.on("error", (err) => console.error("[Redis] Error:", err.message));
redis.on("reconnecting", () => console.log("[Redis] Reconnecting..."));

redisSub.on("connect", () => console.log("[Redis Sub] Connected"));
redisSub.on("error", (err) => console.error("[Redis Sub] Error:", err.message));

redisPub.on("connect", () => console.log("[Redis Pub] Connected"));
redisPub.on("error", (err) => console.error("[Redis Pub] Error:", err.message));

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
