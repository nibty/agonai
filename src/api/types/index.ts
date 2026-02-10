import { z } from "zod";

// Re-export preset system
export * from "./presets.js";
import { getPresetIds, getDefaultPreset } from "./presets.js";

// ============================================================================
// Core Enums
// ============================================================================

export type DebatePosition = "pro" | "con";
export type DebateStatus = "pending" | "in_progress" | "voting" | "completed" | "cancelled";
export type RoundStatus = "pending" | "bot_responding" | "voting" | "completed";

// ============================================================================
// Timing Configuration
// ============================================================================

// Maximum seconds to wait for bot response (absolute limit)
export const BOT_TIMEOUT_SECONDS = 120;

/**
 * @deprecated Use preset system instead (getAllPresets, getPreset)
 * Legacy format summary - returns the default preset configuration
 */
export const DEBATE_FORMAT = {
  get name() {
    return getDefaultPreset().name;
  },
  get rounds() {
    return getDefaultPreset().rounds;
  },
  get roundCount() {
    return getDefaultPreset().rounds.length;
  },
  get winCondition() {
    return getDefaultPreset().winCondition;
  },
  speakingOrder: "Pro first, then Con",
  get timing() {
    const preset = getDefaultPreset();
    return {
      prepTime: preset.prepTime,
      voteWindow: preset.voteWindow,
      botTimeout: BOT_TIMEOUT_SECONDS,
    };
  },
};

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
  roundIndex: number;
  position: DebatePosition;
  botId: number;
  content: string;
  timestamp: Date;
}

export interface RoundResult {
  roundIndex: number;
  roundName: string;
  proVotes: number;
  conVotes: number;
  winner: DebatePosition;
}

export interface Debate {
  id: number;
  topicId: number;
  topic: string;
  presetId: string;
  proBotId: number;
  conBotId: number;
  status: DebateStatus;
  currentRoundIndex: number;
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
  roundIndex: number;
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
  presetId: string;
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
  round: z.enum(["opening", "argument", "rebuttal", "counter", "closing", "question", "answer"]),
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
      round: z.number(),
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

// Validate bot response against word/char limits
export function validateBotResponse(
  message: string,
  wordLimit: { min: number; max: number },
  charLimit: { min: number; max: number }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const wordCount = countWords(message);
  const charCount = message.length;

  if (wordCount < wordLimit.min) {
    errors.push(`Response too short: ${wordCount} words (minimum ${wordLimit.min})`);
  }
  if (wordCount > wordLimit.max) {
    errors.push(`Response too long: ${wordCount} words (maximum ${wordLimit.max})`);
  }
  if (charCount < charLimit.min) {
    errors.push(`Response too short: ${charCount} characters (minimum ${charLimit.min})`);
  }
  if (charCount > charLimit.max) {
    errors.push(`Response too long: ${charCount} characters (maximum ${charLimit.max})`);
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
  preset: import("./presets.js").DebatePreset;
}

export interface RoundStartedPayload {
  round: string;  // Round name (e.g., "Opening", "Rebuttal")
  roundIndex: number;
  timeLimit: number;
}

export interface BotMessagePayload {
  round: string;  // Round name
  roundIndex: number;
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
  round: string;  // Round name
  roundIndex: number;
  timeLimit: number;
}

export interface VoteUpdatePayload {
  round: string;  // Round name
  roundIndex: number;
  proVotes: number;
  conVotes: number;
}

export interface RoundEndedPayload {
  round: string;  // Round name
  roundIndex: number;
  result: {
    roundIndex: number;
    roundName: string;
    proVotes: number;
    conVotes: number;
    winner: DebatePosition;
  };
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

export const BotTypeSchema = z.enum(["http", "openclaw"]).default("http");
export type BotType = z.infer<typeof BotTypeSchema>;

export const RegisterBotSchema = z.object({
  name: z.string().min(1).max(50),
  endpoint: z.string().url(),
  authToken: z.string().optional(),
  type: BotTypeSchema,
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
  presetId: z.string().refine((id) => getPresetIds().includes(id), {
    message: "Invalid preset ID",
  }).default("classic"),
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
  roundIndex: z.coerce.number().int().min(0),
  choice: z.enum(["pro", "con"]),
});

export type SubmitVoteRequest = z.infer<typeof SubmitVoteSchema>;
