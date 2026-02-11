import { nanoid } from "nanoid";
import type { QueueEntry, Bot } from "../types/index.js";
import { getExpandedMatchRange, isBalancedMatch } from "./elo.js";
import { redis, KEYS, isRedisAvailable } from "./redis.js";
import { logger } from "./logger.js";

interface MatchResult<T> {
  entry1: QueueEntry;
  entry2: QueueEntry;
  debate: T;
}

/**
 * Matchmaking Service
 *
 * Manages the queue of bots waiting for matches and pairs them based on ELO.
 * Uses expanding range over time to ensure matches happen.
 *
 * State is stored in Redis for horizontal scaling.
 */
export class MatchmakingService {
  // In-memory fallback when Redis is unavailable
  private localQueue: Map<string, QueueEntry> = new Map();
  private localBotToEntry: Map<number, string> = new Map();

  private useRedis(): boolean {
    return isRedisAvailable();
  }

  /**
   * Add a bot to the matchmaking queue
   */
  async addToQueue(
    bot: Bot,
    userId: number,
    stake: number,
    presetId: string = "classic"
  ): Promise<QueueEntry> {
    // Remove any existing entry for this bot
    await this.removeFromQueue(bot.id);

    const entry: QueueEntry = {
      id: nanoid(),
      botId: bot.id,
      userId,
      presetId,
      elo: bot.elo,
      stake,
      joinedAt: new Date(),
      expandedRange: 100,
    };

    if (this.useRedis()) {
      const pipeline = redis.pipeline();

      // Store entry data as hash
      pipeline.hset(KEYS.QUEUE_ENTRY(entry.id), {
        id: entry.id,
        botId: entry.botId.toString(),
        userId: entry.userId.toString(),
        presetId: entry.presetId,
        elo: entry.elo.toString(),
        stake: entry.stake.toString(),
        joinedAt: entry.joinedAt.toISOString(),
        expandedRange: entry.expandedRange.toString(),
      });

      // Add to sorted set (score = join timestamp)
      pipeline.zadd(KEYS.QUEUE, entry.joinedAt.getTime(), entry.id);

      // Track bot -> entry mapping
      pipeline.hset(KEYS.BOT_TO_ENTRY, bot.id.toString(), entry.id);

      // Set TTL (entries expire after 1 hour if not matched)
      pipeline.expire(KEYS.QUEUE_ENTRY(entry.id), 3600);

      await pipeline.exec();
    } else {
      this.localQueue.set(entry.id, entry);
      this.localBotToEntry.set(bot.id, entry.id);
    }

    return entry;
  }

  /**
   * Remove a bot from the queue
   */
  async removeFromQueue(botId: number): Promise<boolean> {
    if (this.useRedis()) {
      const entryId = await redis.hget(KEYS.BOT_TO_ENTRY, botId.toString());
      if (!entryId) return false;

      const pipeline = redis.pipeline();
      pipeline.del(KEYS.QUEUE_ENTRY(entryId));
      pipeline.zrem(KEYS.QUEUE, entryId);
      pipeline.hdel(KEYS.BOT_TO_ENTRY, botId.toString());
      await pipeline.exec();

      return true;
    } else {
      const entryId = this.localBotToEntry.get(botId);
      if (!entryId) return false;

      this.localQueue.delete(entryId);
      this.localBotToEntry.delete(botId);
      return true;
    }
  }

  /**
   * Check if a bot is in the queue
   */
  async isInQueue(botId: number): Promise<boolean> {
    if (this.useRedis()) {
      const entryId = await redis.hget(KEYS.BOT_TO_ENTRY, botId.toString());
      return entryId !== null;
    } else {
      return this.localBotToEntry.has(botId);
    }
  }

  /**
   * Get queue entry for a bot
   */
  async getEntry(botId: number): Promise<QueueEntry | undefined> {
    if (this.useRedis()) {
      const entryId = await redis.hget(KEYS.BOT_TO_ENTRY, botId.toString());
      if (!entryId) return undefined;

      const data = await redis.hgetall(KEYS.QUEUE_ENTRY(entryId));
      if (!data || !data["id"]) return undefined;

      return this.parseEntry(data);
    } else {
      const entryId = this.localBotToEntry.get(botId);
      if (!entryId) return undefined;
      return this.localQueue.get(entryId);
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<{ queueSize: number; avgWaitTime: number }> {
    if (this.useRedis()) {
      const queueSize = await redis.zcard(KEYS.QUEUE);
      if (queueSize === 0) {
        return { queueSize: 0, avgWaitTime: 0 };
      }

      // Get all entry IDs to calculate wait times
      const entryIds = await redis.zrange(KEYS.QUEUE, 0, -1);
      if (entryIds.length === 0) {
        return { queueSize: 0, avgWaitTime: 0 };
      }

      const now = Date.now();
      let totalWait = 0;

      // Batch get all entries
      const pipeline = redis.pipeline();
      for (const id of entryIds) {
        pipeline.hget(KEYS.QUEUE_ENTRY(id), "joinedAt");
      }
      const results = await pipeline.exec();

      if (results) {
        for (const [, result] of results) {
          if (result) {
            const joinedAt = new Date(result as string).getTime();
            totalWait += now - joinedAt;
          }
        }
      }

      return {
        queueSize,
        avgWaitTime: Math.round(totalWait / queueSize / 1000),
      };
    } else {
      const entries = Array.from(this.localQueue.values());
      if (entries.length === 0) {
        return { queueSize: 0, avgWaitTime: 0 };
      }

      const now = Date.now();
      const totalWait = entries.reduce((sum, e) => sum + (now - e.joinedAt.getTime()), 0);

      return {
        queueSize: entries.length,
        avgWaitTime: Math.round(totalWait / entries.length / 1000),
      };
    }
  }

  /**
   * Get all queue entries
   */
  private async getAllEntries(): Promise<QueueEntry[]> {
    if (this.useRedis()) {
      // Get all entry IDs sorted by join time (oldest first)
      const entryIds = await redis.zrange(KEYS.QUEUE, 0, -1);
      if (entryIds.length === 0) return [];

      // Batch get all entry data
      const pipeline = redis.pipeline();
      for (const id of entryIds) {
        pipeline.hgetall(KEYS.QUEUE_ENTRY(id));
      }
      const results = await pipeline.exec();

      const entries: QueueEntry[] = [];
      if (results) {
        for (const [err, data] of results) {
          if (!err && data && typeof data === "object" && (data as Record<string, string>)["id"]) {
            entries.push(this.parseEntry(data as Record<string, string>));
          }
        }
      }

      return entries;
    } else {
      return Array.from(this.localQueue.values()).sort(
        (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
      );
    }
  }

  /**
   * Parse entry from Redis hash data
   */
  private parseEntry(data: Record<string, string>): QueueEntry {
    return {
      id: data["id"] as string,
      botId: parseInt(data["botId"] as string, 10),
      userId: parseInt(data["userId"] as string, 10),
      presetId: data["presetId"] as string,
      elo: parseInt(data["elo"] as string, 10),
      stake: parseFloat(data["stake"] as string),
      joinedAt: new Date(data["joinedAt"] as string),
      expandedRange: parseInt(data["expandedRange"] as string, 10),
    };
  }

  /**
   * Update expanded ranges based on wait time
   */
  private async updateRanges(): Promise<void> {
    const now = Date.now();

    if (this.useRedis()) {
      const entryIds = await redis.zrange(KEYS.QUEUE, 0, -1);
      if (entryIds.length === 0) return;

      // Get all entries
      const pipeline = redis.pipeline();
      for (const id of entryIds) {
        pipeline.hgetall(KEYS.QUEUE_ENTRY(id));
      }
      const results = await pipeline.exec();

      // Update ranges
      const updatePipeline = redis.pipeline();
      if (results) {
        for (const [err, data] of results) {
          if (!err && data && typeof data === "object") {
            const entry = data as Record<string, string>;
            if (entry["joinedAt"]) {
              const waitSeconds = (now - new Date(entry["joinedAt"]).getTime()) / 1000;
              const newRange = getExpandedMatchRange(waitSeconds);
              updatePipeline.hset(
                KEYS.QUEUE_ENTRY(entry["id"] as string),
                "expandedRange",
                newRange.toString()
              );
            }
          }
        }
      }
      await updatePipeline.exec();
    } else {
      for (const entry of this.localQueue.values()) {
        const waitSeconds = (now - entry.joinedAt.getTime()) / 1000;
        entry.expandedRange = getExpandedMatchRange(waitSeconds);
      }
    }
  }

  /**
   * Find a match for a given entry
   */
  private findMatch(entry: QueueEntry, entries: QueueEntry[]): QueueEntry | null {
    let bestMatch: QueueEntry | null = null;
    let bestEloDiff = Infinity;

    for (const candidate of entries) {
      // Skip self
      if (candidate.id === entry.id) {
        continue;
      }

      // Must match same preset
      if (candidate.presetId !== entry.presetId) {
        continue;
      }

      // Check ELO range - use the wider of the two ranges
      const maxRange = Math.max(entry.expandedRange, candidate.expandedRange);
      if (!isBalancedMatch(entry.elo, candidate.elo, maxRange)) {
        continue;
      }

      // Check stake compatibility (within 20%)
      const stakeDiff = Math.abs(entry.stake - candidate.stake);
      const maxStakeDiff = Math.max(entry.stake, candidate.stake) * 0.2;
      if (stakeDiff > maxStakeDiff) {
        continue;
      }

      // Find closest ELO match
      const eloDiff = Math.abs(entry.elo - candidate.elo);
      if (eloDiff < bestEloDiff) {
        bestMatch = candidate;
        bestEloDiff = eloDiff;
      }
    }

    return bestMatch;
  }

  /**
   * Remove entries from queue after matching
   */
  private async removeEntries(entry1: QueueEntry, entry2: QueueEntry): Promise<void> {
    if (this.useRedis()) {
      const pipeline = redis.pipeline();
      pipeline.del(KEYS.QUEUE_ENTRY(entry1.id));
      pipeline.del(KEYS.QUEUE_ENTRY(entry2.id));
      pipeline.zrem(KEYS.QUEUE, entry1.id, entry2.id);
      pipeline.hdel(KEYS.BOT_TO_ENTRY, entry1.botId.toString(), entry2.botId.toString());
      await pipeline.exec();
    } else {
      this.localQueue.delete(entry1.id);
      this.localQueue.delete(entry2.id);
      this.localBotToEntry.delete(entry1.botId);
      this.localBotToEntry.delete(entry2.botId);
    }
  }

  /**
   * Run matchmaking loop - find all possible matches
   */
  async runMatchmaking<T>(
    createDebate: (entry1: QueueEntry, entry2: QueueEntry) => T | Promise<T>
  ): Promise<MatchResult<T>[]> {
    await this.updateRanges();

    const matches: MatchResult<T>[] = [];
    const matched = new Set<string>();

    // Get all entries sorted by wait time
    const entries = await this.getAllEntries();

    for (const entry of entries) {
      if (matched.has(entry.id)) continue;

      const match = this.findMatch(entry, entries);
      if (match && !matched.has(match.id)) {
        matched.add(entry.id);
        matched.add(match.id);

        try {
          const debate = await createDebate(entry, match);

          matches.push({
            entry1: entry,
            entry2: match,
            debate,
          });

          // Remove from queue
          await this.removeEntries(entry, match);
        } catch (error) {
          logger.error({ err: error }, "Failed to create debate");
          // Re-add entries to queue on failure
          matched.delete(entry.id);
          matched.delete(match.id);
        }
      }
    }

    return matches;
  }
}

// Singleton instance
export const matchmaking = new MatchmakingService();
