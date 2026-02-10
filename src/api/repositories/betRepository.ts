import { eq, and } from "drizzle-orm";
import { db, bets } from "../db/index.js";
import type { Bet, NewBet, DebatePosition } from "../db/types.js";

export const betRepository = {
  async findById(id: number): Promise<Bet | undefined> {
    const result = await db.select().from(bets).where(eq(bets.id, id)).limit(1);
    return result[0];
  },

  async create(data: NewBet): Promise<Bet> {
    const result = await db.insert(bets).values(data).returning();
    const bet = result[0];
    if (!bet) {
      throw new Error("Failed to create bet");
    }
    return bet;
  },

  async getByDebate(debateId: number): Promise<Bet[]> {
    return db.select().from(bets).where(eq(bets.debateId, debateId));
  },

  async getByBettor(bettorId: number): Promise<Bet[]> {
    return db.select().from(bets).where(eq(bets.bettorId, bettorId));
  },

  async getPoolStats(debateId: number): Promise<{
    totalBets: number;
    proBets: number;
    conBets: number;
    totalPool: number;
  }> {
    const allBets = await this.getByDebate(debateId);

    let proBets = 0;
    let conBets = 0;

    for (const bet of allBets) {
      if (bet.side === "pro") proBets += bet.amount;
      else conBets += bet.amount;
    }

    return {
      totalBets: allBets.length,
      proBets,
      conBets,
      totalPool: proBets + conBets,
    };
  },

  async settleBets(
    debateId: number,
    winner: DebatePosition | null
  ): Promise<{ bettorId: number; amount: number }[]> {
    const debateBets = await this.getByDebate(debateId);
    const payouts: { bettorId: number; amount: number }[] = [];

    // If tie (no winner), refund all bets
    if (winner === null) {
      for (const bet of debateBets) {
        payouts.push({ bettorId: bet.bettorId, amount: bet.amount });
        await db
          .update(bets)
          .set({ settled: true, payout: bet.amount })
          .where(eq(bets.id, bet.id));
      }
      return payouts;
    }

    // Calculate total pool and winning pool
    let totalPool = 0;
    let winningPool = 0;

    for (const bet of debateBets) {
      totalPool += bet.amount;
      if (bet.side === winner) {
        winningPool += bet.amount;
      }
    }

    // Platform fee (10%)
    const platformFee = totalPool * 0.1;
    const payoutPool = totalPool - platformFee;

    // Settle each bet
    for (const bet of debateBets) {
      let payout = 0;

      if (bet.side === winner && winningPool > 0) {
        // Proportional payout
        const share = bet.amount / winningPool;
        payout = Math.floor(payoutPool * share);
        payouts.push({ bettorId: bet.bettorId, amount: payout });
      }

      // Update bet record
      await db
        .update(bets)
        .set({ settled: true, payout })
        .where(eq(bets.id, bet.id));
    }

    return payouts;
  },

  async hasUserBet(debateId: number, bettorId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(bets)
      .where(and(eq(bets.debateId, debateId), eq(bets.bettorId, bettorId)))
      .limit(1);

    return result.length > 0;
  },

  async getUserBet(debateId: number, bettorId: number): Promise<Bet | undefined> {
    const result = await db
      .select()
      .from(bets)
      .where(and(eq(bets.debateId, debateId), eq(bets.bettorId, bettorId)))
      .limit(1);

    return result[0];
  },
};
