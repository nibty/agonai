/**
 * API Client for AI Debates Arena backend
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface ApiError {
  error: string;
  details?: string;
}

class ApiClient {
  private authToken: string | null = null;

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${path}`, init);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error || "API request failed");
    }

    return response.json();
  }

  // Health & Stats
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request("GET", "/health");
  }

  async getStats(): Promise<{
    queue: { queueSize: number; avgWaitTime: number };
    activeDebates: number;
    totalBots: number;
  }> {
    return this.request("GET", "/stats");
  }

  // User
  async getMe(): Promise<{ user: User }> {
    return this.request("GET", "/user/me");
  }

  async getUser(walletAddress: string): Promise<{ user: UserPublic }> {
    return this.request("GET", `/user/${walletAddress}`);
  }

  // Bots
  async getBots(): Promise<{ bots: BotPublic[] }> {
    return this.request("GET", "/bots");
  }

  async getLeaderboard(limit = 50): Promise<{ bots: BotPublic[] }> {
    return this.request("GET", `/bots/leaderboard?limit=${limit}`);
  }

  async getMyBots(): Promise<{ bots: Bot[] }> {
    return this.request("GET", "/bots/my");
  }

  async registerBot(data: {
    name: string;
    endpoint: string;
    authToken: string;
  }): Promise<{ bot: BotPublic }> {
    return this.request("POST", "/bots", data);
  }

  async deleteBot(botId: string): Promise<{ success: boolean }> {
    return this.request("DELETE", `/bots/${botId}`);
  }

  // Topics
  async getTopics(params?: {
    category?: string;
    sort?: "popular" | "newest" | "used";
    limit?: number;
  }): Promise<{ topics: Topic[] }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.sort) searchParams.set("sort", params.sort);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.request("GET", `/topics${query ? `?${query}` : ""}`);
  }

  async submitTopic(data: {
    text: string;
    category: string;
  }): Promise<{ topic: Topic }> {
    return this.request("POST", "/topics", data);
  }

  async voteTopic(
    topicId: string,
    upvote: boolean
  ): Promise<{ topic: Topic }> {
    return this.request("POST", `/topics/${topicId}/vote`, { upvote });
  }

  // Queue
  async getQueueStats(): Promise<{ queueSize: number; avgWaitTime: number }> {
    return this.request("GET", "/queue/stats");
  }

  async joinQueue(data: {
    botId: string;
    stake: number;
  }): Promise<{ entry: QueueEntry }> {
    return this.request("POST", "/queue/join", data);
  }

  async leaveQueue(botId: string): Promise<{ success: boolean }> {
    return this.request("POST", "/queue/leave", { botId });
  }

  // Debates
  async getActiveDebates(): Promise<{ debates: Debate[] }> {
    return this.request("GET", "/debates/active");
  }

  async getDebate(debateId: string): Promise<{ debate: Debate }> {
    return this.request("GET", `/debates/${debateId}`);
  }

  // Betting
  async placeBet(data: {
    debateId: string;
    side: "pro" | "con";
    amount: number;
  }): Promise<{ bet: Bet }> {
    return this.request("POST", "/bets", data);
  }

  async getBettingPool(debateId: string): Promise<{
    totalBets: number;
    proBets: number;
    conBets: number;
    totalPool: number;
  }> {
    return this.request("GET", `/bets/${debateId}`);
  }
}

// Types matching backend
interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  elo: number;
  wins: number;
  losses: number;
  botCount: number;
  createdAt: string;
}

interface UserPublic {
  id: string;
  walletAddress: string;
  username: string | null;
  elo: number;
  wins: number;
  losses: number;
  botCount: number;
}

interface Bot {
  id: string;
  ownerId: string;
  name: string;
  endpoint: string;
  elo: number;
  wins: number;
  losses: number;
  isActive: boolean;
  createdAt: string;
}

interface BotPublic {
  id: string;
  ownerId: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  isActive?: boolean;
}

interface Topic {
  id: string;
  text: string;
  category: string;
  proposerId: string;
  upvotes: number;
  downvotes: number;
  timesUsed: number;
  createdAt: string;
}

interface QueueEntry {
  id: string;
  botId: string;
  userId: string;
  elo: number;
  stake: number;
  joinedAt: string;
}

interface Debate {
  id: string;
  topicId: string;
  topic: string;
  proBotId: string;
  conBotId: string;
  status: "pending" | "in_progress" | "voting" | "completed" | "cancelled";
  currentRound: "opening" | "rebuttal" | "closing";
  roundStatus: "pending" | "bot_responding" | "voting" | "completed";
  roundResults: Array<{
    round: "opening" | "rebuttal" | "closing";
    proVotes: number;
    conVotes: number;
    winner: "pro" | "con";
  }>;
  winner: "pro" | "con" | null;
  stake: number;
  spectatorCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Bet {
  id: string;
  debateId: string;
  bettorId: string;
  amount: number;
  side: "pro" | "con";
  settled: boolean;
  payout: number | null;
  createdAt: string;
}

// Export singleton instance
export const api = new ApiClient();

// Export types
export type {
  User,
  UserPublic,
  Bot,
  BotPublic,
  Topic,
  QueueEntry,
  Debate,
  Bet,
};
