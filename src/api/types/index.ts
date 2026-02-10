import { z } from "zod";

// ============================================================================
// Core Enums
// ============================================================================

export type DebateRound = "opening" | "rebuttal" | "closing";
export type DebatePosition = "pro" | "con";
export type DebateStatus = "pending" | "in_progress" | "voting" | "completed" | "cancelled";
export type RoundStatus = "pending" | "bot_responding" | "voting" | "completed";

export const DEBATE_ROUNDS: DebateRound[] = ["opening", "rebuttal", "closing"];

// ============================================================================
// Debate Specifications
// ============================================================================

/**
 * Debate Format: Best of 3 rounds
 * - Opening: Present main argument
 * - Rebuttal: Counter opponent's points
 * - Closing: Final summary and appeal
 *
 * Each round: Pro speaks first, then Con
 * Spectators vote after each round
 * Winner determined by rounds won (2/3)
 */

// Time limits in seconds for bot responses per round
export const ROUND_TIME_LIMITS: Record<DebateRound, number> = {
  opening: 60,
  rebuttal: 90,
  closing: 60,
};

// Word limits per round response
export const ROUND_WORD_LIMITS: Record<DebateRound, { min: number; max: number }> = {
  opening: { min: 100, max: 300 },
  rebuttal: { min: 150, max: 400 },
  closing: { min: 100, max: 250 },
};

// Character limits per round response
export const ROUND_CHAR_LIMITS: Record<DebateRound, { min: number; max: number }> = {
  opening: { min: 500, max: 2000 },
  rebuttal: { min: 750, max: 2500 },
  closing: { min: 500, max: 1500 },
};

// Timing configuration
export const TIMING = {
  /** Seconds before debate starts after match */
  PREP_TIME: 30,
  /** Seconds for spectators to vote after each round */
  VOTE_WINDOW: 15,
  /** Maximum seconds to wait for bot response */
  BOT_TIMEOUT: 120,
  /** Milliseconds between vote count updates */
  VOTE_UPDATE_INTERVAL: 1000,
} as const;

// Legacy exports for backward compatibility
export const ROUND_DURATIONS = ROUND_TIME_LIMITS;
export const VOTE_WINDOW_SECONDS = TIMING.VOTE_WINDOW;
export const PREP_TIME_SECONDS = TIMING.PREP_TIME;
export const BOT_TIMEOUT_SECONDS = TIMING.BOT_TIMEOUT;

// Debate format summary for API responses
export const DEBATE_FORMAT = {
  name: "Best of 3",
  rounds: DEBATE_ROUNDS,
  roundCount: 3,
  winCondition: "Win 2 of 3 rounds",
  speakingOrder: "Pro first, then Con",
  timing: {
    prepTime: TIMING.PREP_TIME,
    voteWindow: TIMING.VOTE_WINDOW,
    botTimeout: TIMING.BOT_TIMEOUT,
    roundTimeLimits: ROUND_TIME_LIMITS,
  },
  limits: {
    words: ROUND_WORD_LIMITS,
    characters: ROUND_CHAR_LIMITS,
  },
} as const;

// ============================================================================
// User & Bot Types
// ============================================================================

export interface User {
  id: number;
  walletAddress: string;
  username: string | null;
  elo: number;
  wins: number;
  losses: number;
  botCount: number;
  createdAt: Date;
}

export interface Bot {
  id: number;
  ownerId: number;
  name: string;
  endpoint: string;
  authTokenHash: string | null; // SHA-256 hashed auth token
  elo: number;
  wins: number;
  losses: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotPublic {
  id: number;
  ownerId: number;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  isActive: boolean;
}

// ============================================================================
// Topic Types
// ============================================================================

export interface Topic {
  id: number;
  text: string;
  category: string;
  proposerId: number | null;
  upvotes: number;
  downvotes: number;
  timesUsed: number;
  createdAt: Date;
}

// ============================================================================
// Debate Types
// ============================================================================

export interface DebateMessage {
  id: number;
  debateId: number;
  round: DebateRound;
  position: DebatePosition;
  botId: number;
  content: string;
  timestamp: Date;
}

export interface RoundResult {
  round: DebateRound;
  proVotes: number;
  conVotes: number;
  winner: DebatePosition;
}

export interface Debate {
  id: number;
  topicId: number;
  topic: string;
  proBotId: number;
  conBotId: number;
  status: DebateStatus;
  currentRound: DebateRound;
  roundStatus: RoundStatus;
  roundResults: RoundResult[];
  winner: DebatePosition | null;
  stake: number; // In lamports (XNT)
  spectatorCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface Vote {
  id: number;
  debateId: number;
  round: DebateRound;
  voterId: number;
  choice: DebatePosition;
  timestamp: Date;
}

export interface Bet {
  id: number;
  debateId: number;
  bettorId: number;
  amount: number; // In lamports (XNT)
  side: DebatePosition;
  settled: boolean;
  payout: number | null;
  createdAt: Date;
}

// ============================================================================
// Queue Types
// ============================================================================

export interface QueueEntry {
  id: string;
  botId: number;
  userId: number;
  elo: number;
  stake: number;
  joinedAt: Date;
  expandedRange: number; // Increases over time for faster matching
}

// ============================================================================
// Bot API Types (what bot endpoints receive/respond)
// ============================================================================

export const BotRequestSchema = z.object({
  debate_id: z.string(),
  round: z.enum(["opening", "rebuttal", "closing"]),
  topic: z.string(),
  position: z.enum(["pro", "con"]),
  opponent_last_message: z.string().nullable(),
  time_limit_seconds: z.number(),
  word_limit: z.object({
    min: z.number(),
    max: z.number(),
  }),
  char_limit: z.object({
    min: z.number(),
    max: z.number(),
  }),
  messages_so_far: z.array(
    z.object({
      round: z.enum(["opening", "rebuttal", "closing"]),
      position: z.enum(["pro", "con"]),
      content: z.string(),
    })
  ),
});

export type BotRequest = z.infer<typeof BotRequestSchema>;

export const BotResponseSchema = z.object({
  message: z.string().min(1).max(10000),
  confidence: z.number().min(0).max(1).optional(),
});

// Helper to count words in a string
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Validate bot response against limits
export function validateBotResponse(
  message: string,
  round: DebateRound
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const wordCount = countWords(message);
  const charCount = message.length;
  const wordLimits = ROUND_WORD_LIMITS[round];
  const charLimits = ROUND_CHAR_LIMITS[round];

  if (wordCount < wordLimits.min) {
    errors.push(`Response too short: ${wordCount} words (minimum ${wordLimits.min})`);
  }
  if (wordCount > wordLimits.max) {
    errors.push(`Response too long: ${wordCount} words (maximum ${wordLimits.max})`);
  }
  if (charCount < charLimits.min) {
    errors.push(`Response too short: ${charCount} characters (minimum ${charLimits.min})`);
  }
  if (charCount > charLimits.max) {
    errors.push(`Response too long: ${charCount} characters (maximum ${charLimits.max})`);
  }

  return { valid: errors.length === 0, errors };
}

export type BotResponse = z.infer<typeof BotResponseSchema>;

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type WSMessageType =
  | "debate_started"
  | "round_started"
  | "bot_message"
  | "bot_typing"
  | "voting_started"
  | "vote_update"
  | "round_ended"
  | "debate_ended"
  | "spectator_count"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  debateId: number;
  payload: unknown;
}

export interface DebateStartedPayload {
  debate: Debate;
  proBot: BotPublic;
  conBot: BotPublic;
  topic: Topic;
}

export interface RoundStartedPayload {
  round: DebateRound;
  timeLimit: number;
}

export interface BotMessagePayload {
  round: DebateRound;
  position: DebatePosition;
  botId: number;
  content: string;
  isComplete: boolean;
}

export interface BotTypingPayload {
  position: DebatePosition;
  botId: number;
}

export interface VotingStartedPayload {
  round: DebateRound;
  timeLimit: number;
}

export interface VoteUpdatePayload {
  round: DebateRound;
  proVotes: number;
  conVotes: number;
}

export interface RoundEndedPayload {
  round: DebateRound;
  result: RoundResult;
  overallScore: { pro: number; con: number };
}

export interface DebateEndedPayload {
  winner: DebatePosition;
  finalScore: { pro: number; con: number };
  eloChanges: {
    proBot: { oldElo: number; newElo: number; change: number };
    conBot: { oldElo: number; newElo: number; change: number };
  };
  payouts: Array<{ bettorId: number; amount: number }>;
}

export interface SpectatorCountPayload {
  count: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export const RegisterBotSchema = z.object({
  name: z.string().min(1).max(50),
  endpoint: z.string().url(),
  authToken: z.string().optional(),
});

export type RegisterBotRequest = z.infer<typeof RegisterBotSchema>;

export const SubmitTopicSchema = z.object({
  text: z.string().min(10).max(500),
  category: z.enum(["tech", "crypto", "politics", "philosophy", "pop-culture", "other"]),
});

export type SubmitTopicRequest = z.infer<typeof SubmitTopicSchema>;

export const JoinQueueSchema = z.object({
  botId: z.coerce.number().int().positive(),
  stake: z.number().min(0),
});

export type JoinQueueRequest = z.infer<typeof JoinQueueSchema>;

export const PlaceBetSchema = z.object({
  debateId: z.coerce.number().int().positive(),
  side: z.enum(["pro", "con"]),
  amount: z.number().positive(),
});

export type PlaceBetRequest = z.infer<typeof PlaceBetSchema>;

export const SubmitVoteSchema = z.object({
  debateId: z.coerce.number().int().positive(),
  round: z.enum(["opening", "rebuttal", "closing"]),
  choice: z.enum(["pro", "con"]),
});

export type SubmitVoteRequest = z.infer<typeof SubmitVoteSchema>;
