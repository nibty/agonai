import { nanoid } from "nanoid";
import type { QueueEntry, Bot, Debate } from "../types/index.js";
import { getExpandedMatchRange, isBalancedMatch } from "./elo.js";

interface MatchResult {
  entry1: QueueEntry;
  entry2: QueueEntry;
  debate: Debate;
}

/**
 * Matchmaking Service
 *
 * Manages the queue of bots waiting for matches and pairs them based on ELO.
 * Uses expanding range over time to ensure matches happen.
 */
export class MatchmakingService {
  private queue: Map<string, QueueEntry> = new Map();
  private botToEntry: Map<string, string> = new Map(); // botId -> entryId

  /**
   * Add a bot to the matchmaking queue
   */
  addToQueue(bot: Bot, userId: string, stake: number): QueueEntry {
    // Remove any existing entry for this bot
    const existingEntryId = this.botToEntry.get(bot.id);
    if (existingEntryId) {
      this.queue.delete(existingEntryId);
    }

    const entry: QueueEntry = {
      id: nanoid(),
      botId: bot.id,
      userId,
      elo: bot.elo,
      stake,
      joinedAt: new Date(),
      expandedRange: 100,
    };

    this.queue.set(entry.id, entry);
    this.botToEntry.set(bot.id, entry.id);

    return entry;
  }

  /**
   * Remove a bot from the queue
   */
  removeFromQueue(botId: string): boolean {
    const entryId = this.botToEntry.get(botId);
    if (!entryId) return false;

    this.queue.delete(entryId);
    this.botToEntry.delete(botId);
    return true;
  }

  /**
   * Check if a bot is in the queue
   */
  isInQueue(botId: string): boolean {
    return this.botToEntry.has(botId);
  }

  /**
   * Get queue entry for a bot
   */
  getEntry(botId: string): QueueEntry | undefined {
    const entryId = this.botToEntry.get(botId);
    if (!entryId) return undefined;
    return this.queue.get(entryId);
  }

  /**
   * Get queue stats
   */
  getStats(): { queueSize: number; avgWaitTime: number } {
    const entries = Array.from(this.queue.values());
    if (entries.length === 0) {
      return { queueSize: 0, avgWaitTime: 0 };
    }

    const now = Date.now();
    const totalWait = entries.reduce(
      (sum, e) => sum + (now - e.joinedAt.getTime()),
      0
    );

    return {
      queueSize: entries.length,
      avgWaitTime: Math.round(totalWait / entries.length / 1000),
    };
  }

  /**
   * Update expanded ranges based on wait time
   */
  updateRanges(): void {
    const now = Date.now();
    for (const entry of this.queue.values()) {
      const waitSeconds = (now - entry.joinedAt.getTime()) / 1000;
      entry.expandedRange = getExpandedMatchRange(waitSeconds);
    }
  }

  /**
   * Find a match for a given entry
   */
  findMatch(entry: QueueEntry): QueueEntry | null {
    let bestMatch: QueueEntry | null = null;
    let bestEloDiff = Infinity;

    for (const candidate of this.queue.values()) {
      // Skip self
      if (candidate.id === entry.id) continue;

      // Skip same owner (can't play against yourself)
      if (candidate.userId === entry.userId) continue;

      // Check ELO range - use the wider of the two ranges
      const maxRange = Math.max(entry.expandedRange, candidate.expandedRange);
      if (!isBalancedMatch(entry.elo, candidate.elo, maxRange)) continue;

      // Check stake compatibility (within 20%)
      const stakeDiff = Math.abs(entry.stake - candidate.stake);
      const maxStakeDiff = Math.max(entry.stake, candidate.stake) * 0.2;
      if (stakeDiff > maxStakeDiff) continue;

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
   * Run matchmaking loop - find all possible matches
   */
  runMatchmaking(
    createDebate: (entry1: QueueEntry, entry2: QueueEntry) => Debate
  ): MatchResult[] {
    this.updateRanges();

    const matches: MatchResult[] = [];
    const matched = new Set<string>();

    // Sort by wait time (longest waiting first)
    const entries = Array.from(this.queue.values()).sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
    );

    for (const entry of entries) {
      if (matched.has(entry.id)) continue;

      const match = this.findMatch(entry);
      if (match && !matched.has(match.id)) {
        matched.add(entry.id);
        matched.add(match.id);

        const debate = createDebate(entry, match);

        matches.push({
          entry1: entry,
          entry2: match,
          debate,
        });

        // Remove from queue
        this.queue.delete(entry.id);
        this.queue.delete(match.id);
        this.botToEntry.delete(entry.botId);
        this.botToEntry.delete(match.botId);
      }
    }

    return matches;
  }
}

// Singleton instance
export const matchmaking = new MatchmakingService();
