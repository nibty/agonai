import { z } from "zod";

// ============================================================================
// Core Enums
// ============================================================================

export type DebateRound = "opening" | "rebuttal" | "closing";
export type DebatePosition = "pro" | "con";
export type DebateStatus = "pending" | "in_progress" | "voting" | "completed" | "cancelled";
export type RoundStatus = "pending" | "bot_responding" | "voting" | "completed";

export const DEBATE_ROUNDS: DebateRound[] = ["opening", "rebuttal", "closing"];

export const ROUND_DURATIONS: Record<DebateRound, number> = {
  opening: 60,
  rebuttal: 90,
  closing: 60,
};

export const VOTE_WINDOW_SECONDS = 15;
export const PREP_TIME_SECONDS = 30;
export const BOT_TIMEOUT_SECONDS = 120;

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
  category: z.enum(["tech", "crypto", "politics", "philosophy", "pop_culture", "other"]),
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
