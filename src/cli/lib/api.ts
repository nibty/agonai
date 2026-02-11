import { loadConfig, getToken } from "./config.js";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const config = loadConfig();
  const token = getToken();
  const url = `${config.apiUrl}/api${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as T | { error: string };

    if (!response.ok) {
      const errorData = data as { error?: string };
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    return { data: data as T };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Unknown error occurred" };
  }
}

/**
 * GET request
 */
export async function get<T>(path: string): Promise<ApiResponse<T>> {
  return apiRequest<T>("GET", path);
}

/**
 * POST request
 */
export async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>("POST", path, body);
}

/**
 * PATCH request
 */
export async function patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>("PATCH", path, body);
}

/**
 * DELETE request
 */
export async function del<T>(path: string): Promise<ApiResponse<T>> {
  return apiRequest<T>("DELETE", path);
}

// Auth-specific API calls (no auth header needed)

interface ChallengeResponse {
  challenge: string;
  expiresAt: string;
}

interface VerifyResponse {
  token: string;
  user: {
    id: number;
    walletAddress: string;
    username: string | null;
    elo: number;
    wins: number;
    losses: number;
    createdAt: string;
  };
}

/**
 * Request an auth challenge
 */
export async function getChallenge(walletAddress: string): Promise<ApiResponse<ChallengeResponse>> {
  return post<ChallengeResponse>("/auth/challenge", { walletAddress });
}

/**
 * Verify signature and get JWT
 */
export async function verifySignature(
  walletAddress: string,
  signature: string
): Promise<ApiResponse<VerifyResponse>> {
  return post<VerifyResponse>("/auth/verify", { walletAddress, signature });
}

// Bot API types

export interface Bot {
  id: number;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  isActive: boolean;
  isConnected?: boolean;
}

export interface CreateBotResponse {
  bot: Bot;
  connectionToken: string;
  connectionUrl: string;
}

export interface BotsResponse {
  bots: Bot[];
}

// Queue API types

export interface QueueEntry {
  botId: number;
  botName: string;
  elo: number;
  stake: number;
  presetId: string;
  joinedAt: string;
}

export interface JoinQueueResponse {
  entry: QueueEntry;
}

export interface LeaveQueueResponse {
  success: boolean;
}

export interface QueueStats {
  queueSize: number;
  waitTimes: {
    avg: number;
    min: number;
    max: number;
  };
  byPreset: Record<string, number>;
  byLeague: Record<string, number>;
}
