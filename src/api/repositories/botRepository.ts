import { eq, desc, sql } from "drizzle-orm";
import { db, bots } from "../db/index.js";
import type { Bot, NewBot, BotPublic } from "../db/types.js";
import { createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toPublic(bot: Bot): BotPublic {
  return {
    id: bot.id,
    ownerId: bot.ownerId,
    name: bot.name,
    elo: bot.elo,
    wins: bot.wins,
    losses: bot.losses,
    isActive: bot.isActive,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}

export const botRepository = {
  async findById(id: number): Promise<Bot | undefined> {
    const result = await db.select().from(bots).where(eq(bots.id, id)).limit(1);
    return result[0];
  },

  async findByIdPublic(id: number): Promise<BotPublic | undefined> {
    const bot = await this.findById(id);
    return bot ? toPublic(bot) : undefined;
  },

  async findByOwner(ownerId: number): Promise<Bot[]> {
    return db.select().from(bots).where(eq(bots.ownerId, ownerId));
  },

  async findByOwnerPublic(ownerId: number): Promise<BotPublic[]> {
    const result = await this.findByOwner(ownerId);
    return result.map(toPublic);
  },

  async create(ownerId: number, name: string, endpoint: string, authToken?: string): Promise<Bot> {
    const result = await db
      .insert(bots)
      .values({
        ownerId,
        name,
        endpoint,
        authTokenHash: authToken ? hashToken(authToken) : null,
      })
      .returning();

    const bot = result[0];
    if (!bot) {
      throw new Error("Failed to create bot");
    }
    return bot;
  },

  async update(id: number, data: Partial<Omit<NewBot, "authTokenHash">> & { authToken?: string }): Promise<Bot | undefined> {
    const updateData: Partial<NewBot> = { ...data, updatedAt: new Date() };

    if (data.authToken) {
      updateData.authTokenHash = hashToken(data.authToken);
      delete (updateData as Record<string, unknown>)["authToken"];
    }

    const result = await db
      .update(bots)
      .set(updateData)
      .where(eq(bots.id, id))
      .returning();
    return result[0];
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(bots).where(eq(bots.id, id)).returning();
    return result.length > 0;
  },

  async getAll(): Promise<BotPublic[]> {
    const result = await db.select().from(bots);
    return result.map(toPublic);
  },

  async getLeaderboard(limit = 100): Promise<BotPublic[]> {
    const result = await db
      .select()
      .from(bots)
      .where(eq(bots.isActive, true))
      .orderBy(desc(bots.elo))
      .limit(limit);
    return result.map(toPublic);
  },

  async updateStats(id: number, isWin: boolean, eloChange: number): Promise<Bot | undefined> {
    const bot = await this.findById(id);
    if (!bot) return undefined;

    return this.update(id, {
      elo: bot.elo + eloChange,
      wins: isWin ? bot.wins + 1 : bot.wins,
      losses: isWin ? bot.losses : bot.losses + 1,
    });
  },

  async countByOwner(ownerId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bots)
      .where(eq(bots.ownerId, ownerId));
    return result[0]?.count ?? 0;
  },

  async verifyAuth(id: number, authToken: string): Promise<boolean> {
    const bot = await this.findById(id);
    if (!bot) return false;
    return bot.authTokenHash === hashToken(authToken);
  },
};
