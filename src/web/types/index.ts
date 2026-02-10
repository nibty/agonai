// User types
export interface User {
  wallet: string;
  username: string | null;
  avatar: string | null;
  elo: number;
  wins: number;
  losses: number;
  botCount: number;
  rank: Rank;
  achievements: Achievement[];
  createdAt: Date;
}

export type Rank = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "champion";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

// Bot types
export interface Bot {
  id: string;
  owner: string;
  name: string;
  avatar: string | null;
  endpoint: string;
  elo: number;
  wins: number;
  losses: number;
  tier: BotTier;
  personalityTags: string[];
  createdAt: Date;
}

export type BotTier = 1 | 2 | 3 | 4 | 5;

export interface BotRequest {
  debate_id: string;
  round: DebateRound;
  topic: string;
  position: Position;
  opponent_last_message: string | null;
  time_limit_seconds: number;
}

export interface BotResponse {
  message: string;
  confidence?: number;
}

// Debate types
export interface Debate {
  id: string;
  topic: Topic;
  proBot: Bot;
  conBot: Bot;
  status: DebateStatus;
  currentRound: DebateRound;
  roundResults: RoundResult[];
  winner: Bot | null;
  stake: number;
  spectatorCount: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

export type DebateStatus =
  | "pending"
  | "prep"
  | "opening"
  | "rebuttal"
  | "closing"
  | "voting"
  | "completed";

export type DebateRound = "opening" | "rebuttal" | "closing";

export type Position = "pro" | "con";

export interface RoundResult {
  round: DebateRound;
  proVotes: number;
  conVotes: number;
  winner: Position;
}

export interface DebateMessage {
  id: string;
  debateId: string;
  round: DebateRound;
  position: Position;
  botId: string;
  content: string;
  timestamp: Date;
}

// Topic types
export interface Topic {
  id: string;
  text: string;
  category: TopicCategory;
  proposer: string;
  upvotes: number;
  usedCount: number;
  createdAt: Date;
}

export type TopicCategory = "politics" | "tech" | "philosophy" | "pop-culture" | "crypto";

// Vote types
export interface Vote {
  id: string;
  debateId: string;
  voter: string;
  round: DebateRound;
  choice: Position;
  weight: number;
  timestamp: Date;
}

// Bet types
export interface Bet {
  id: string;
  debateId: string;
  bettor: string;
  amount: number;
  side: Position;
  settled: boolean;
  payout: number | null;
  createdAt: Date;
}

// Season types
export interface Season {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  rewardPool: number;
}

// ELO calculation
export interface EloChange {
  oldElo: number;
  newElo: number;
  change: number;
}

// Matchmaking
export interface QueueEntry {
  botId: string;
  userId: string;
  elo: number;
  joinedAt: Date;
}

export interface Match {
  proBot: Bot;
  conBot: Bot;
  topic: Topic;
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  user: User;
  bot: Bot;
  change: number; // Position change from previous period
}

// Config
export interface X1Config {
  rpcEndpoint: string;
  programId: string;
  networkName: string;
}

export const DEFAULT_X1_CONFIG: X1Config = {
  rpcEndpoint: "https://rpc.mainnet.x1.xyz/",
  programId: "", // Will be set after program deployment
  networkName: "X1 Mainnet",
};

// Time constants
export const DEBATE_TIMING = {
  PREP_SECONDS: 30,
  OPENING_SECONDS: 60,
  REBUTTAL_SECONDS: 90,
  CLOSING_SECONDS: 60,
  VOTING_SECONDS: 15,
} as const;

// ELO constants
export const ELO_CONFIG = {
  DEFAULT_ELO: 1000,
  K_FACTOR: 32,
  BRONZE_MAX: 999,
  SILVER_MAX: 1499,
  GOLD_MAX: 1999,
  PLATINUM_MAX: 2499,
  DIAMOND_MAX: 2999,
} as const;

// Rank helper
export function getRankFromElo(elo: number): Rank {
  if (elo >= 3000) return "champion";
  if (elo >= 2500) return "diamond";
  if (elo >= 2000) return "platinum";
  if (elo >= 1500) return "gold";
  if (elo >= 1000) return "silver";
  return "bronze";
}

// Bot tier helper (1-5 based on ELO)
export function getTierFromElo(elo: number): BotTier {
  if (elo >= 2500) return 5 as BotTier;
  if (elo >= 2000) return 4 as BotTier;
  if (elo >= 1500) return 3 as BotTier;
  if (elo >= 1000) return 2 as BotTier;
  return 1 as BotTier;
}
