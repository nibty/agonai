import { createHmac } from "crypto";
import type {
  BotRequest,
  BotResponse,
  DebatePosition,
  RoundConfig,
} from "../types/index.js";
import { BotResponseSchema, BOT_TIMEOUT_SECONDS } from "../types/index.js";

// Bot interface for the runner - needs endpoint for calling
interface BotForRunner {
  id: number;
  endpoint: string;
  authToken?: string | null; // Decrypted auth token for HMAC signing
}

// Message interface for building requests
interface MessageForRunner {
  roundIndex: number;
  position: DebatePosition;
  content: string;
}

interface BotCallResult {
  success: boolean;
  response?: BotResponse;
  error?: string;
  latencyMs: number;
}

/**
 * Bot Runner Service
 *
 * Handles calling external bot endpoints with timeouts and error handling.
 * Validates responses and enforces time limits.
 * Signs requests with HMAC-SHA256 when auth token is available.
 */
export class BotRunnerService {
  private readonly defaultTimeout = BOT_TIMEOUT_SECONDS * 1000;

  /**
   * Create HMAC-SHA256 signature for a request
   * Signature = HMAC(key=authToken, message=timestamp.body)
   */
  private createSignature(authToken: string, timestamp: number, body: string): string {
    const message = `${timestamp}.${body}`;
    return createHmac("sha256", authToken).update(message).digest("hex");
  }

  /**
   * Call a bot's endpoint and get its response
   */
  async callBot(
    bot: BotForRunner,
    request: BotRequest,
    timeout = this.defaultTimeout
  ): Promise<BotCallResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const body = JSON.stringify(request);
      const timestamp = Math.floor(Date.now() / 1000);

      // Build headers with optional HMAC signature
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Debate-ID": request.debate_id,
        "X-Timestamp": String(timestamp),
      };

      // Add signature if bot has an auth token configured
      if (bot.authToken) {
        headers["X-Signature"] = this.createSignature(bot.authToken, timestamp, body);
      }

      const response = await fetch(bot.endpoint, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: `Bot returned status ${response.status}: ${response.statusText}`,
          latencyMs,
        };
      }

      const data: unknown = await response.json();

      // Validate response against schema
      const parseResult = BotResponseSchema.safeParse(data);
      if (!parseResult.success) {
        return {
          success: false,
          error: `Invalid bot response: ${parseResult.error.message}`,
          latencyMs,
        };
      }

      return {
        success: true,
        response: parseResult.data,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: `Bot timed out after ${timeout}ms`,
            latencyMs,
          };
        }
        return {
          success: false,
          error: `Bot call failed: ${error.message}`,
          latencyMs,
        };
      }

      return {
        success: false,
        error: "Unknown error calling bot",
        latencyMs,
      };
    }
  }

  /**
   * Build a request to send to a bot
   */
  buildRequest(
    debateId: number,
    roundIndex: number,
    roundConfig: RoundConfig,
    topic: string,
    position: DebatePosition,
    previousMessages: MessageForRunner[]
  ): BotRequest {
    // Find opponent's last message in this round or previous round
    const opponentMessages = previousMessages.filter((m) => m.position !== position);
    const lastOpponentMessage =
      opponentMessages.length > 0 ? opponentMessages[opponentMessages.length - 1] : null;

    // Calculate char limits based on word limits (average ~5 chars per word + margin)
    const charLimit = {
      min: roundConfig.wordLimit.min * 4,
      max: roundConfig.wordLimit.max * 7,
    };

    return {
      debate_id: String(debateId),
      round: roundConfig.type,
      topic,
      position,
      opponent_last_message: lastOpponentMessage?.content ?? null,
      time_limit_seconds: roundConfig.timeLimit,
      word_limit: roundConfig.wordLimit,
      char_limit: charLimit,
      messages_so_far: previousMessages.map((m) => ({
        round: roundIndex,
        position: m.position,
        content: m.content,
      })),
    };
  }

  /**
   * Test a bot endpoint to verify it's working
   * @param bot - Bot with endpoint and optional authToken for signed requests
   */
  async testBot(bot: BotForRunner): Promise<{ success: boolean; error?: string }> {
    const testRequest: BotRequest = {
      debate_id: "test",
      round: "opening",
      topic: "This is a test topic to verify your bot is working correctly.",
      position: "pro",
      opponent_last_message: null,
      time_limit_seconds: 30,
      word_limit: { min: 100, max: 300 },
      char_limit: { min: 400, max: 2100 },
      messages_so_far: [],
    };

    // Test with signature if auth token provided
    const result = await this.callBot(bot, testRequest, 30000); // 30s timeout for test

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error,
    };
  }
}

// Singleton instance
export const botRunner = new BotRunnerService();
