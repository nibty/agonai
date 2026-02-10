import type { BotRequest, BotResponse, DebatePosition, RoundConfig } from "../types/index.js";
import { BOT_TIMEOUT_SECONDS } from "../types/index.js";
import { getBotConnectionServer } from "../ws/botConnectionServer.js";

// Bot interface for the runner
interface BotForRunner {
  id: number;
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
 * Handles calling bots via WebSocket connections.
 * Validates responses and enforces time limits.
 */
export class BotRunnerService {
  private readonly defaultTimeout = BOT_TIMEOUT_SECONDS * 1000;

  /**
   * Call a bot via WebSocket and get its response
   */
  async callBot(
    bot: BotForRunner,
    request: BotRequest,
    timeout = this.defaultTimeout
  ): Promise<BotCallResult> {
    const startTime = Date.now();
    const wsServer = getBotConnectionServer();

    if (!wsServer) {
      return {
        success: false,
        error: "WebSocket server not initialized",
        latencyMs: 0,
      };
    }

    if (!wsServer.isConnected(bot.id)) {
      return {
        success: false,
        error: "Bot is not connected",
        latencyMs: 0,
      };
    }

    try {
      const response = await wsServer.sendRequest(bot.id, request, timeout);
      return {
        success: true,
        response,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "WebSocket call failed",
        latencyMs: Date.now() - startTime,
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
   * Check if a bot is connected and ready
   */
  isConnected(botId: number): boolean {
    const wsServer = getBotConnectionServer();
    return wsServer?.isConnected(botId) ?? false;
  }
}

// Singleton instance
export const botRunner = new BotRunnerService();
