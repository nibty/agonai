import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  bigint,
  unique,
} from "drizzle-orm/pg-core";

// ============================================================================
// Users
// ============================================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 44 }).notNull().unique(),
  username: varchar("username", { length: 32 }),
  elo: integer("elo").notNull().default(1200),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Bots
// ============================================================================

export const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  authTokenHash: varchar("auth_token_hash", { length: 64 }),
  elo: integer("elo").notNull().default(1200),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Topics
// ============================================================================

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  text: varchar("text", { length: 500 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  proposerId: integer("proposer_id").references(() => users.id),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  timesUsed: integer("times_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Topic Votes (normalized)
// ============================================================================

export const topicVotes = pgTable(
  "topic_votes",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    voterId: integer("voter_id")
      .notNull()
      .references(() => users.id),
    isUpvote: boolean("is_upvote").notNull(),
  },
  (table) => [unique("topic_voter_unique").on(table.topicId, table.voterId)]
);

// ============================================================================
// Debates
// ============================================================================

export const debates = pgTable("debates", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topics.id),
  proBotId: integer("pro_bot_id")
    .notNull()
    .references(() => bots.id),
  conBotId: integer("con_bot_id")
    .notNull()
    .references(() => bots.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  currentRound: varchar("current_round", { length: 10 }).notNull().default("opening"),
  roundStatus: varchar("round_status", { length: 20 }).notNull().default("pending"),
  winner: varchar("winner", { length: 3 }),
  stake: bigint("stake", { mode: "number" }).notNull().default(0),
  spectatorCount: integer("spectator_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ============================================================================
// Round Results (normalized from embedded array)
// ============================================================================

export const roundResults = pgTable(
  "round_results",
  {
    id: serial("id").primaryKey(),
    debateId: integer("debate_id")
      .notNull()
      .references(() => debates.id, { onDelete: "cascade" }),
    round: varchar("round", { length: 10 }).notNull(),
    proVotes: integer("pro_votes").notNull().default(0),
    conVotes: integer("con_votes").notNull().default(0),
    winner: varchar("winner", { length: 3 }).notNull(),
  },
  (table) => [unique("debate_round_unique").on(table.debateId, table.round)]
);

// ============================================================================
// Debate Messages (bot responses)
// ============================================================================

export const debateMessages = pgTable("debate_messages", {
  id: serial("id").primaryKey(),
  debateId: integer("debate_id")
    .notNull()
    .references(() => debates.id, { onDelete: "cascade" }),
  round: varchar("round", { length: 10 }).notNull(),
  position: varchar("position", { length: 3 }).notNull(),
  botId: integer("bot_id")
    .notNull()
    .references(() => bots.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Votes (spectator round votes)
// ============================================================================

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    debateId: integer("debate_id")
      .notNull()
      .references(() => debates.id, { onDelete: "cascade" }),
    round: varchar("round", { length: 10 }).notNull(),
    voterId: integer("voter_id")
      .notNull()
      .references(() => users.id),
    choice: varchar("choice", { length: 3 }).notNull(),
  },
  (table) => [unique("debate_round_voter_unique").on(table.debateId, table.round, table.voterId)]
);

// ============================================================================
// Bets
// ============================================================================

export const bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  debateId: integer("debate_id")
    .notNull()
    .references(() => debates.id, { onDelete: "cascade" }),
  bettorId: integer("bettor_id")
    .notNull()
    .references(() => users.id),
  amount: bigint("amount", { mode: "number" }).notNull(),
  side: varchar("side", { length: 3 }).notNull(),
  settled: boolean("settled").notNull().default(false),
  payout: bigint("payout", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Auth Challenges (for wallet auth)
// ============================================================================

export const authChallenges = pgTable("auth_challenges", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
  nonce: varchar("nonce", { length: 64 }).notNull(),
  message: text("message").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
});
