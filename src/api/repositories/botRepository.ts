import { eq, desc, sql } from "drizzle-orm";
import { db, bots } from "../db/index.js";
import type { Bot, NewBot, BotPublic } from "../db/types.js";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encryption key from environment (32 bytes for AES-256)
// In production, use a secure key management service
const ENCRYPTION_KEY = process.env.BOT_TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-prod!!"; // 32 chars

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function encryptToken(token: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
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
        authTokenEncrypted: authToken ? encryptToken(authToken) : null,
      })
      .returning();

    const bot = result[0];
    if (!bot) {
      throw new Error("Failed to create bot");
    }
    return bot;
  },

  async update(id: number, data: Partial<Omit<NewBot, "authTokenHash" | "authTokenEncrypted">> & { authToken?: string }): Promise<Bot | undefined> {
    const updateData: Partial<NewBot> = { ...data, updatedAt: new Date() };

    if (data.authToken) {
      updateData.authTokenHash = hashToken(data.authToken);
      updateData.authTokenEncrypted = encryptToken(data.authToken);
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
