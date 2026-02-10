import { eq, desc, sql, gte, and } from "drizzle-orm";
import { db, topics, topicVotes } from "../db/index.js";
import type { Topic, NewTopic } from "../db/types.js";

export const topicRepository = {
  async findById(id: number): Promise<Topic | undefined> {
    const result = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    return result[0];
  },

  async create(data: NewTopic): Promise<Topic> {
    const result = await db.insert(topics).values(data).returning();
    const topic = result[0];
    if (!topic) {
      throw new Error("Failed to create topic");
    }
    return topic;
  },

  async getTopics(
    category?: string,
    sort: "popular" | "newest" | "used" = "popular",
    limit = 50
  ): Promise<Topic[]> {
    let query = db.select().from(topics).$dynamic();

    if (category) {
      query = query.where(eq(topics.category, category));
    }

    switch (sort) {
      case "popular":
        query = query.orderBy(desc(sql`${topics.upvotes} - ${topics.downvotes}`));
        break;
      case "newest":
        query = query.orderBy(desc(topics.createdAt));
        break;
      case "used":
        query = query.orderBy(desc(topics.timesUsed));
        break;
    }

    return query.limit(limit);
  },

  async vote(topicId: number, voterId: number, isUpvote: boolean): Promise<Topic | undefined> {
    // Check if user already voted
    const existingVote = await db
      .select()
      .from(topicVotes)
      .where(and(eq(topicVotes.topicId, topicId), eq(topicVotes.voterId, voterId)))
      .limit(1);

    if (existingVote.length > 0) {
      const existing = existingVote[0];
      if (!existing) return this.findById(topicId);

      // If same vote, ignore
      if (existing.isUpvote === isUpvote) {
        return this.findById(topicId);
      }

      // Change vote: update the vote record and adjust counts
      await db
        .update(topicVotes)
        .set({ isUpvote })
        .where(eq(topicVotes.id, existing.id));

      // Adjust counts (flip from one to other)
      if (isUpvote) {
        await db
          .update(topics)
          .set({
            upvotes: sql`${topics.upvotes} + 1`,
            downvotes: sql`${topics.downvotes} - 1`,
          })
          .where(eq(topics.id, topicId));
      } else {
        await db
          .update(topics)
          .set({
            upvotes: sql`${topics.upvotes} - 1`,
            downvotes: sql`${topics.downvotes} + 1`,
          })
          .where(eq(topics.id, topicId));
      }
    } else {
      // New vote
      await db.insert(topicVotes).values({
        topicId,
        voterId,
        isUpvote,
      });

      if (isUpvote) {
        await db
          .update(topics)
          .set({ upvotes: sql`${topics.upvotes} + 1` })
          .where(eq(topics.id, topicId));
      } else {
        await db
          .update(topics)
          .set({ downvotes: sql`${topics.downvotes} + 1` })
          .where(eq(topics.id, topicId));
      }
    }

    return this.findById(topicId);
  },

  async getRandomTopic(): Promise<Topic | undefined> {
    // Weighted random selection based on score (upvotes - downvotes)
    // Higher score = more likely to be picked
    // Formula: RANDOM() * (score + 5)^2
    // The +5 baseline ensures all topics have a chance
    const result = await db
      .select()
      .from(topics)
      .where(gte(sql`${topics.upvotes} - ${topics.downvotes}`, -2)) // Allow slightly negative scores
      .orderBy(
        desc(sql`RANDOM() * POWER(GREATEST(1, ${topics.upvotes} - ${topics.downvotes} + 5), 2)`)
      )
      .limit(1);
    return result[0];
  },

  async markUsed(topicId: number): Promise<void> {
    await db
      .update(topics)
      .set({ timesUsed: sql`${topics.timesUsed} + 1` })
      .where(eq(topics.id, topicId));
  },

  async getUserVote(topicId: number, voterId: number): Promise<boolean | null> {
    const result = await db
      .select()
      .from(topicVotes)
      .where(and(eq(topicVotes.topicId, topicId), eq(topicVotes.voterId, voterId)))
      .limit(1);
    return result[0]?.isUpvote ?? null;
  },
};
