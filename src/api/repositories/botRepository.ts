import { eq, desc, sql } from "drizzle-orm";
import { db, bots } from "../db/index.js";
import type { Bot, NewBot, BotPublic } from "../db/types.js";
import { createDecipheriv, randomBytes } from "crypto";

// Encryption key from environment (32 bytes for AES-256)
// Used for decrypting legacy tokens if needed
const ENCRYPTION_KEY = process.env.BOT_TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-prod!!"; // 32 chars

function generateConnectionToken(): string {
  return randomBytes(32).toString("hex"); // 64 char hex string
}

function decryptToken(encrypted: string): string | null {
  try {
    const [ivHex, encryptedData] = encrypted.split(":");
    if (!ivHex || !encryptedData) return null;
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

export { decryptToken };

function toPublic(bot: Bot): BotPublic {
  return {
    id: bot.id,
    ownerId: bot.ownerId,
    name: bot.name,
    type: "websocket",
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

  async findByConnectionToken(token: string): Promise<Bot | undefined> {
    const result = await db.select().from(bots).where(eq(bots.connectionToken, token)).limit(1);
    return result[0];
  },

  async findByOwnerPublic(ownerId: number): Promise<BotPublic[]> {
    const result = await this.findByOwner(ownerId);
    return result.map(toPublic);
  },

  async create(ownerId: number, name: string): Promise<Bot> {
    const connectionToken = generateConnectionToken();
    const result = await db
      .insert(bots)
      .values({
        ownerId,
        name,
        endpoint: "", // Not used for WebSocket bots
        type: "websocket",
        connectionToken,
      })
      .returning();

    const bot = result[0];
    if (!bot) {
      throw new Error("Failed to create bot");
    }
    return bot;
  },

  async update(id: number, data: Partial<Pick<NewBot, "name" | "isActive">>): Promise<Bot | undefined> {
    const updateData = { ...data, updatedAt: new Date() };

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

    const result = await db
      .update(bots)
      .set({
        elo: bot.elo + eloChange,
        wins: isWin ? bot.wins + 1 : bot.wins,
        losses: isWin ? bot.losses : bot.losses + 1,
        updatedAt: new Date(),
      })
      .where(eq(bots.id, id))
      .returning();
    return result[0];
  },

  async countByOwner(ownerId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bots)
      .where(eq(bots.ownerId, ownerId));
    return result[0]?.count ?? 0;
  },

  async regenerateConnectionToken(id: number): Promise<string | null> {
    const newToken = generateConnectionToken();
    const result = await db
      .update(bots)
      .set({ connectionToken: newToken, updatedAt: new Date() })
      .where(eq(bots.id, id))
      .returning();
    return result[0] ? newToken : null;
  },
};
