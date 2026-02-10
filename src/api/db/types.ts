import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  bots,
  topics,
  topicVotes,
  debates,
  roundResults,
  debateMessages,
  votes,
  bets,
  authChallenges,
} from "./schema.js";

// ============================================================================
// Select Types (what you get from the database)
// ============================================================================

export type User = InferSelectModel<typeof users>;
export type Bot = InferSelectModel<typeof bots>;
export type Topic = InferSelectModel<typeof topics>;
export type TopicVote = InferSelectModel<typeof topicVotes>;
export type Debate = InferSelectModel<typeof debates>;
export type RoundResult = InferSelectModel<typeof roundResults>;
export type DebateMessage = InferSelectModel<typeof debateMessages>;
export type Vote = InferSelectModel<typeof votes>;
export type Bet = InferSelectModel<typeof bets>;
export type AuthChallenge = InferSelectModel<typeof authChallenges>;

// ============================================================================
// Insert Types (what you insert into the database)
// ============================================================================

export type NewUser = InferInsertModel<typeof users>;
export type NewBot = InferInsertModel<typeof bots>;
export type NewTopic = InferInsertModel<typeof topics>;
export type NewTopicVote = InferInsertModel<typeof topicVotes>;
export type NewDebate = InferInsertModel<typeof debates>;
export type NewRoundResult = InferInsertModel<typeof roundResults>;
export type NewDebateMessage = InferInsertModel<typeof debateMessages>;
export type NewVote = InferInsertModel<typeof votes>;
export type NewBet = InferInsertModel<typeof bets>;
export type NewAuthChallenge = InferInsertModel<typeof authChallenges>;

// ============================================================================
// Public Types (for API responses - excludes sensitive fields)
// ============================================================================

export type BotPublic = Omit<Bot, "authTokenHash" | "authTokenEncrypted" | "endpoint">;

export type UserPublic = Omit<User, "updatedAt">;

// ============================================================================
// Domain Types (re-exported from original types for compatibility)
// ============================================================================

export type DebatePosition = "pro" | "con";
export type DebateStatus = "pending" | "in_progress" | "voting" | "completed" | "cancelled";
export type RoundStatus = "pending" | "bot_responding" | "voting" | "completed";
