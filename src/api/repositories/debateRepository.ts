import { eq, and, inArray, desc } from "drizzle-orm";
import { db, debates, roundResults, debateMessages, votes } from "../db/index.js";
import type {
  Debate,
  NewDebate,
  RoundResult,
  NewRoundResult,
  DebateMessage,
  NewDebateMessage,
  Vote,
  NewVote,
  DebateRound,
} from "../db/types.js";

export const debateRepository = {
  // ============================================================================
  // Debate Operations
  // ============================================================================

  async findById(id: number): Promise<Debate | undefined> {
    const result = await db.select().from(debates).where(eq(debates.id, id)).limit(1);
    return result[0];
  },

  async create(data: NewDebate): Promise<Debate> {
    const result = await db.insert(debates).values(data).returning();
    const debate = result[0];
    if (!debate) {
      throw new Error("Failed to create debate");
    }
    return debate;
  },

  async update(id: number, data: Partial<NewDebate>): Promise<Debate | undefined> {
    const result = await db
      .update(debates)
      .set(data)
      .where(eq(debates.id, id))
      .returning();
    return result[0];
  },

  async getActive(): Promise<Debate[]> {
    return db
      .select()
      .from(debates)
      .where(inArray(debates.status, ["pending", "in_progress", "voting"]))
      .orderBy(desc(debates.createdAt));
  },

  async getRecent(limit = 20): Promise<Debate[]> {
    return db
      .select()
      .from(debates)
      .orderBy(desc(debates.createdAt))
      .limit(limit);
  },

  // ============================================================================
  // Round Results Operations
  // ============================================================================

  async addRoundResult(data: NewRoundResult): Promise<RoundResult> {
    const result = await db.insert(roundResults).values(data).returning();
    const roundResult = result[0];
    if (!roundResult) {
      throw new Error("Failed to create round result");
    }
    return roundResult;
  },

  async getRoundResults(debateId: number): Promise<RoundResult[]> {
    return db
      .select()
      .from(roundResults)
      .where(eq(roundResults.debateId, debateId));
  },

  async updateRoundResult(
    debateId: number,
    round: DebateRound,
    data: Partial<NewRoundResult>
  ): Promise<RoundResult | undefined> {
    const result = await db
      .update(roundResults)
      .set(data)
      .where(and(eq(roundResults.debateId, debateId), eq(roundResults.round, round)))
      .returning();
    return result[0];
  },

  // ============================================================================
  // Debate Messages Operations
  // ============================================================================

  async addMessage(data: NewDebateMessage): Promise<DebateMessage> {
    const result = await db.insert(debateMessages).values(data).returning();
    const message = result[0];
    if (!message) {
      throw new Error("Failed to create debate message");
    }
    return message;
  },

  async getMessages(debateId: number): Promise<DebateMessage[]> {
    return db
      .select()
      .from(debateMessages)
      .where(eq(debateMessages.debateId, debateId))
      .orderBy(debateMessages.createdAt);
  },

  async getMessagesByRound(debateId: number, round: DebateRound): Promise<DebateMessage[]> {
    return db
      .select()
      .from(debateMessages)
      .where(and(eq(debateMessages.debateId, debateId), eq(debateMessages.round, round)))
      .orderBy(debateMessages.createdAt);
  },

  // ============================================================================
  // Voting Operations
  // ============================================================================

  async submitVote(data: NewVote): Promise<Vote | null> {
    // Check if already voted
    const existing = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.debateId, data.debateId),
          eq(votes.round, data.round),
          eq(votes.voterId, data.voterId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return null; // Already voted
    }

    const result = await db.insert(votes).values(data).returning();
    return result[0] ?? null;
  },

  async getRoundVotes(debateId: number, round: DebateRound): Promise<Vote[]> {
    return db
      .select()
      .from(votes)
      .where(and(eq(votes.debateId, debateId), eq(votes.round, round)));
  },

  async countRoundVotes(
    debateId: number,
    round: DebateRound
  ): Promise<{ proVotes: number; conVotes: number }> {
    const allVotes = await this.getRoundVotes(debateId, round);

    let proVotes = 0;
    let conVotes = 0;

    for (const vote of allVotes) {
      if (vote.choice === "pro") proVotes++;
      else conVotes++;
    }

    return { proVotes, conVotes };
  },

  async hasVoted(debateId: number, round: DebateRound, voterId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.debateId, debateId),
          eq(votes.round, round),
          eq(votes.voterId, voterId)
        )
      )
      .limit(1);

    return result.length > 0;
  },

  // ============================================================================
  // Full Debate With Relations (for API responses)
  // ============================================================================

  async getFullDebate(id: number): Promise<{
    debate: Debate;
    roundResults: RoundResult[];
    messages: DebateMessage[];
  } | null> {
    const debate = await this.findById(id);
    if (!debate) return null;

    const [results, messages] = await Promise.all([
      this.getRoundResults(id),
      this.getMessages(id),
    ]);

    return {
      debate,
      roundResults: results,
      messages,
    };
  },
};
