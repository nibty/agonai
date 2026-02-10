import type {
  BotRequest,
  BotResponse,
  DebateRound,
  DebatePosition,
} from "../types/index.js";
import { BotResponseSchema, BOT_TIMEOUT_SECONDS } from "../types/index.js";

// Bot interface for the runner - needs endpoint for calling
interface BotForRunner {
  id: number;
  endpoint: string;
}

// Message interface for building requests
interface MessageForRunner {
  round: DebateRound;
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
 */
export class BotRunnerService {
  private readonly defaultTimeout = BOT_TIMEOUT_SECONDS * 1000;

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

      const response = await fetch(bot.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debate-ID": request.debate_id,
        },
        body: JSON.stringify(request),
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
    round: DebateRound,
    topic: string,
    position: DebatePosition,
    timeLimit: number,
    previousMessages: MessageForRunner[]
  ): BotRequest {
    // Find opponent's last message in this round or previous round
    const opponentMessages = previousMessages.filter((m) => m.position !== position);
    const lastOpponentMessage =
      opponentMessages.length > 0 ? opponentMessages[opponentMessages.length - 1] : null;

    return {
      debate_id: String(debateId),
      round,
      topic,
      position,
      opponent_last_message: lastOpponentMessage?.content ?? null,
      time_limit_seconds: timeLimit,
      messages_so_far: previousMessages.map((m) => ({
        round: m.round,
        position: m.position,
        content: m.content,
      })),
    };
  }

  /**
   * Test a bot endpoint to verify it's working
   */
  async testBot(bot: BotForRunner): Promise<{ success: boolean; error?: string }> {
    const testRequest: BotRequest = {
      debate_id: "test",
      round: "opening",
      topic: "This is a test topic to verify your bot is working correctly.",
      position: "pro",
      opponent_last_message: null,
      time_limit_seconds: 30,
      messages_so_far: [],
    };

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
