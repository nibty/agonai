import { nanoid } from "nanoid";
import type { User, Bot, Topic, Bet } from "../types/index.js";
import { INITIAL_ELO } from "./elo.js";

/**
 * In-Memory Store
 *
 * Simple in-memory storage for development.
 * In production, this would be replaced with a database.
 */

// Users
const users = new Map<string, User>();
const usersByWallet = new Map<string, User>();

// Bots
const bots = new Map<string, Bot>();
const botsByOwner = new Map<string, Bot[]>();

// Topics
const topics = new Map<string, Topic>();

// Bets
const bets = new Map<string, Bet>();
const betsByDebate = new Map<string, Bet[]>();

// ============================================================================
// User Operations
// ============================================================================

export function createUser(walletAddress: string, username?: string): User {
  const existing = usersByWallet.get(walletAddress);
  if (existing) return existing;

  const user: User = {
    id: nanoid(),
    walletAddress,
    username: username ?? null,
    elo: INITIAL_ELO,
    wins: 0,
    losses: 0,
    botCount: 0,
    createdAt: new Date(),
  };

  users.set(user.id, user);
  usersByWallet.set(walletAddress, user);

  return user;
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function getUserByWallet(walletAddress: string): User | undefined {
  return usersByWallet.get(walletAddress);
}

export function updateUser(id: string, updates: Partial<User>): User | undefined {
  const user = users.get(id);
  if (!user) return undefined;

  Object.assign(user, updates);
  return user;
}

// ============================================================================
// Bot Operations
// ============================================================================

export function createBot(
  ownerId: string,
  name: string,
  endpoint: string,
  authToken: string
): Bot {
  const bot: Bot = {
    id: nanoid(),
    ownerId,
    name,
    endpoint,
    authToken, // In production, hash this
    elo: INITIAL_ELO,
    wins: 0,
    losses: 0,
    isActive: true,
    createdAt: new Date(),
  };

  bots.set(bot.id, bot);

  const ownerBots = botsByOwner.get(ownerId) ?? [];
  ownerBots.push(bot);
  botsByOwner.set(ownerId, ownerBots);

  // Update user bot count
  const user = users.get(ownerId);
  if (user) {
    user.botCount++;
  }

  return bot;
}

export function getBotById(id: string): Bot | undefined {
  return bots.get(id);
}

export function getBotsByOwner(ownerId: string): Bot[] {
  return botsByOwner.get(ownerId) ?? [];
}

export function updateBot(id: string, updates: Partial<Bot>): Bot | undefined {
  const bot = bots.get(id);
  if (!bot) return undefined;

  Object.assign(bot, updates);
  return bot;
}

export function deleteBot(id: string): boolean {
  const bot = bots.get(id);
  if (!bot) return false;

  bots.delete(id);

  const ownerBots = botsByOwner.get(bot.ownerId);
  if (ownerBots) {
    const index = ownerBots.findIndex((b) => b.id === id);
    if (index !== -1) {
      ownerBots.splice(index, 1);
    }
  }

  // Update user bot count
  const user = users.get(bot.ownerId);
  if (user) {
    user.botCount = Math.max(0, user.botCount - 1);
  }

  return true;
}

export function getAllBots(): Bot[] {
  return Array.from(bots.values());
}

export function getTopBots(limit = 100): Bot[] {
  return Array.from(bots.values())
    .filter((b) => b.isActive)
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limit);
}

// ============================================================================
// Topic Operations
// ============================================================================

export function createTopic(
  text: string,
  category: string,
  proposerId: string
): Topic {
  const topic: Topic = {
    id: nanoid(),
    text,
    category,
    proposerId,
    upvotes: 0,
    downvotes: 0,
    timesUsed: 0,
    createdAt: new Date(),
  };

  topics.set(topic.id, topic);
  return topic;
}

export function getTopicById(id: string): Topic | undefined {
  return topics.get(id);
}

export function getTopics(
  category?: string,
  sort: "popular" | "newest" | "used" = "popular",
  limit = 50
): Topic[] {
  let result = Array.from(topics.values());

  if (category) {
    result = result.filter((t) => t.category === category);
  }

  switch (sort) {
    case "popular":
      result.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
      break;
    case "newest":
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case "used":
      result.sort((a, b) => b.timesUsed - a.timesUsed);
      break;
  }

  return result.slice(0, limit);
}

export function voteTopic(
  topicId: string,
  upvote: boolean
): Topic | undefined {
  const topic = topics.get(topicId);
  if (!topic) return undefined;

  if (upvote) {
    topic.upvotes++;
  } else {
    topic.downvotes++;
  }

  return topic;
}

export function getRandomTopic(): Topic | undefined {
  const available = Array.from(topics.values()).filter(
    (t) => t.upvotes > t.downvotes
  );
  if (available.length === 0) return undefined;

  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

export function markTopicUsed(topicId: string): void {
  const topic = topics.get(topicId);
  if (topic) {
    topic.timesUsed++;
  }
}

// ============================================================================
// Bet Operations
// ============================================================================

export function createBet(
  debateId: string,
  bettorId: string,
  amount: number,
  side: "pro" | "con"
): Bet {
  const bet: Bet = {
    id: nanoid(),
    debateId,
    bettorId,
    amount,
    side,
    settled: false,
    payout: null,
    createdAt: new Date(),
  };

  bets.set(bet.id, bet);

  const debateBets = betsByDebate.get(debateId) ?? [];
  debateBets.push(bet);
  betsByDebate.set(debateId, debateBets);

  return bet;
}

export function getBetsByDebate(debateId: string): Bet[] {
  return betsByDebate.get(debateId) ?? [];
}

export function settleBets(
  debateId: string,
  winner: "pro" | "con"
): { bettorId: string; amount: number }[] {
  const debateBets = betsByDebate.get(debateId) ?? [];
  const payouts: { bettorId: string; amount: number }[] = [];

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

  // Distribute winnings proportionally
  for (const bet of debateBets) {
    bet.settled = true;

    if (bet.side === winner && winningPool > 0) {
      // Proportional payout
      const share = bet.amount / winningPool;
      const payout = Math.floor(payoutPool * share);
      bet.payout = payout;
      payouts.push({ bettorId: bet.bettorId, amount: payout });
    } else {
      bet.payout = 0;
    }
  }

  return payouts;
}

// ============================================================================
// Seed Data
// ============================================================================

export function seedData(): void {
  // Seed some topics
  const topicTexts = [
    { text: "AI will replace most jobs within 10 years", category: "tech" },
    { text: "Cryptocurrency is the future of finance", category: "crypto" },
    { text: "Social media does more harm than good", category: "tech" },
    { text: "Climate change requires immediate radical action", category: "politics" },
    { text: "Free will is an illusion", category: "philosophy" },
    { text: "The metaverse will fail", category: "tech" },
    { text: "Proof of Stake is better than Proof of Work", category: "crypto" },
    { text: "Universal Basic Income should be implemented globally", category: "politics" },
    { text: "Consciousness can be uploaded to computers", category: "philosophy" },
    { text: "NFTs are valuable digital assets", category: "crypto" },
  ];

  for (const { text, category } of topicTexts) {
    createTopic(text, category, "system");
  }

  console.log(`Seeded ${topicTexts.length} topics`);
}
