import { eq } from "drizzle-orm";
import { db, users } from "../db/index.js";
import type { User, NewUser } from "../db/types.js";

export const userRepository = {
  async findById(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  },

  async findByWallet(walletAddress: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.walletAddress, walletAddress)).limit(1);
    return result[0];
  },

  async create(data: NewUser): Promise<User> {
    const result = await db.insert(users).values(data).returning();
    const user = result[0];
    if (!user) {
      throw new Error("Failed to create user");
    }
    return user;
  },

  async findOrCreate(walletAddress: string, username?: string): Promise<User> {
    const existing = await this.findByWallet(walletAddress);
    if (existing) return existing;

    return this.create({
      walletAddress,
      username: username ?? null,
    });
  },

  async update(id: number, data: Partial<NewUser>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  },

  async updateStats(id: number, isWin: boolean, eloChange: number): Promise<User | undefined> {
    const user = await this.findById(id);
    if (!user) return undefined;

    return this.update(id, {
      elo: user.elo + eloChange,
      wins: isWin ? user.wins + 1 : user.wins,
      losses: isWin ? user.losses : user.losses + 1,
    });
  },
};
