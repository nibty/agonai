import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import type { BotRequest, BotResponse } from "../types/index.js";
import { BotResponseSchema } from "../types/index.js";
import { botRepository } from "../repositories/index.js";
import {
  redis,
  redisSub,
  redisPub,
  KEYS,
  INSTANCE_ID,
  isRedisAvailable,
} from "../services/redis.js";
import { createChildLogger } from "../services/logger.js";
import { matchmaking } from "../services/matchmaking.js";
import { getPresetIds } from "../types/index.js";

const logger = createChildLogger({ service: "bot-ws" });

interface ConnectedBot {
  ws: WebSocket;
  botId: number;
  botName: string;
  connectedAt: Date;
}

interface PendingRequest {
  resolve: (response: BotResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// Message types: Server -> Bot
interface DebateRequestMessage {
  type: "debate_request";
  requestId: string;
  debate_id: string;
  round: string;
  topic: string;
  position: "pro" | "con";
  opponent_last_message: string | null;
  time_limit_seconds: number;
  word_limit: { min: number; max: number };
  char_limit: { min: number; max: number };
  messages_so_far: Array<{ round: number; position: "pro" | "con"; content: string }>;
}

interface PingMessage {
  type: "ping";
}

// Message types: Bot -> Server
interface DebateResponseMessage {
  type: "debate_response";
  requestId: string;
  message: string;
  confidence?: number;
}

interface ResponseChunkMessage {
  type: "response_chunk";
  requestId: string;
  text: string;
}

interface PongMessage {
  type: "pong";
}

interface QueueJoinMessage {
  type: "queue_join";
  stake?: number;
  presetId?: string;
}

interface QueueLeaveMessage {
  type: "queue_leave";
}

type BotToServer =
  | DebateResponseMessage
  | ResponseChunkMessage
  | PongMessage
  | QueueJoinMessage
  | QueueLeaveMessage;

// Server -> Bot queue messages
interface QueueJoinedMessage {
  type: "queue_joined";
  queueIds: string[];
  stake: number;
  presetIds: string[];
}

interface QueueLeftMessage {
  type: "queue_left";
}

interface QueueErrorMessage {
  type: "queue_error";
  error: string;
}

interface DebateCompleteMessage {
  type: "debate_complete";
  debateId: number;
  won: boolean | null; // null = tie
  eloChange: number;
}

// Redis pub/sub message types
interface BotRequestPubSubMessage {
  type: "bot_request";
  requestId: string;
  botId: number;
  request: BotRequest;
  timeout: number;
  sourceInstance: string;
}

interface BotResponsePubSubMessage {
  type: "bot_response";
  requestId: string;
  response?: BotResponse;
  error?: string;
}

/**
 * WebSocket Server for Bot Connections
 *
 * Allows bots to connect TO the debate server via WebSocket
 * instead of exposing HTTP endpoints. This enables bots to run
 * behind NATs/firewalls and receive real-time notifications.
 *
 * URL Format: ws://host/bot/connect/{connectionToken}
 *
 * With Redis enabled, supports horizontal scaling:
 * - Bot connections are tracked in Redis
 * - Requests can be routed to the correct instance via pub/sub
 */
export class BotConnectionServer {
  private wss: WebSocketServer;
  private connectedBots: Map<number, ConnectedBot> = new Map(); // Local connections only
  private pendingRequests: Map<string, PendingRequest> = new Map(); // requestId -> pending
  private requestCounter = 0;

  constructor() {
    // Use noServer mode - upgrades handled externally
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (ws, req) => {
      void this.handleConnection(ws, req);
    });

    // Ping connected bots every 30 seconds
    setInterval(() => this.pingAll(), 30000);

    // Initialize Redis subscriptions
    void this.initRedisSubscriptions();

    logger.info({ instance: INSTANCE_ID }, "Server initialized");
  }

  /**
   * Initialize Redis pub/sub for cross-instance communication
   */
  private async initRedisSubscriptions(): Promise<void> {
    const instanceChannel = `bot:instance:${INSTANCE_ID}`;

    // Set up message handler (will receive messages once subscribed)
    redisSub.on("message", (channel, message) => {
      if (channel === instanceChannel) {
        void this.handleRedisMessage(message);
      }
    });

    // Try to subscribe immediately if Redis is ready
    if (isRedisAvailable()) {
      await this.subscribeToInstanceChannel(instanceChannel);
    } else {
      logger.info("Redis not yet available, waiting for connection...");
      // Wait for Redis to connect, then subscribe
      redisSub.once("ready", () => {
        logger.info("Redis subscriber ready, setting up instance channel subscription");
        void this.subscribeToInstanceChannel(instanceChannel);
      });
    }
  }

  /**
   * Subscribe to the instance channel for cross-instance bot requests
   */
  private async subscribeToInstanceChannel(channel: string): Promise<void> {
    try {
      await redisSub.subscribe(channel);
      logger.info({ channel, instanceId: INSTANCE_ID }, "Subscribed to Redis instance channel");
    } catch (error) {
      logger.error({ err: error, channel }, "Failed to subscribe to Redis instance channel");
    }
  }

  /**
   * Handle messages from Redis pub/sub
   */
  private async handleRedisMessage(message: string): Promise<void> {
    try {
      const data = JSON.parse(message) as
        | BotRequestPubSubMessage
        | { type: string; botId: number; debateId: number; won: boolean | null; eloChange: number };

      logger.debug(
        { messageType: data.type, messageLength: message.length },
        "Received Redis pub/sub message"
      );

      if (data.type === "bot_request") {
        const reqData = data as BotRequestPubSubMessage;
        logger.info(
          {
            botId: reqData.botId,
            requestId: reqData.requestId,
            round: reqData.request.round,
            sourceInstance: reqData.sourceInstance,
          },
          "Received cross-instance bot request via Redis"
        );

        // Another instance is asking us to forward a request to a bot we have connected
        const bot = this.connectedBots.get(reqData.botId);
        if (!bot || bot.ws.readyState !== WebSocket.OPEN) {
          // Bot not connected to this instance anymore
          logger.warn(
            {
              botId: reqData.botId,
              requestId: reqData.requestId,
              botExists: !!bot,
              wsReadyState: bot?.ws.readyState,
            },
            "Bot not connected on this instance for cross-instance request"
          );
          await this.sendResponseToInstance(reqData.requestId, undefined, "Bot not connected");
          return;
        }

        // Forward request to the bot
        const requestMessage: DebateRequestMessage = {
          type: "debate_request",
          requestId: reqData.requestId,
          ...reqData.request,
        };

        logger.info(
          {
            botId: reqData.botId,
            botName: bot.botName,
            requestId: reqData.requestId,
            round: reqData.request.round,
          },
          "Forwarding cross-instance request to bot"
        );
        bot.ws.send(JSON.stringify(requestMessage));
      } else if (data.type === "debate_complete_notification") {
        // Forward debate complete notification to locally connected bot
        const notifyData = data as {
          type: string;
          botId: number;
          debateId: number;
          won: boolean | null;
          eloChange: number;
        };
        const bot = this.connectedBots.get(notifyData.botId);
        if (bot && bot.ws.readyState === WebSocket.OPEN) {
          const completeMsg: DebateCompleteMessage = {
            type: "debate_complete",
            debateId: notifyData.debateId,
            won: notifyData.won,
            eloChange: notifyData.eloChange,
          };
          bot.ws.send(JSON.stringify(completeMsg));
          logger.debug(
            { botId: notifyData.botId, debateId: notifyData.debateId },
            "Forwarded debate_complete from Redis"
          );
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Error handling Redis message");
    }
  }

  /**
   * Send response back to the requesting instance via Redis
   */
  private async sendResponseToInstance(
    requestId: string,
    response?: BotResponse,
    error?: string
  ): Promise<void> {
    if (!isRedisAvailable()) return;

    const responseChannel = KEYS.CHANNEL_BOT_RESPONSE(requestId);
    const message: BotResponsePubSubMessage = {
      type: "bot_response",
      requestId,
      response,
      error,
    };

    logger.info(
      {
        requestId,
        responseChannel,
        hasResponse: !!response,
        error: error ?? null,
        responseLength: response?.message?.length ?? 0,
      },
      "Sending cross-instance response via Redis"
    );

    await redisPub.publish(responseChannel, JSON.stringify(message));
  }

  /**
   * Handle an HTTP upgrade request for this WebSocket server
   */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, request);
    });
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = req.url ?? "";
    const tokenMatch = url.match(/^\/bot\/connect\/([a-f0-9]{64})$/);

    if (!tokenMatch) {
      ws.close(4001, "Invalid connection URL");
      return;
    }

    const token = tokenMatch[1] as string;

    // Validate token and get bot
    const bot = await botRepository.findByConnectionToken(token);
    if (!bot) {
      ws.close(4002, "Invalid connection token");
      return;
    }

    // Check if bot is already connected (locally)
    const existing = this.connectedBots.get(bot.id);
    if (existing) {
      logger.info({ botId: bot.id, botName: bot.name }, "Bot reconnecting, closing old connection");
      existing.ws.close(4003, "Replaced by new connection");
    }

    const connectedBot: ConnectedBot = {
      ws,
      botId: bot.id,
      botName: bot.name,
      connectedAt: new Date(),
    };

    this.connectedBots.set(bot.id, connectedBot);

    // Register connection in Redis for cross-instance routing
    if (isRedisAvailable()) {
      await redis.set(KEYS.BOT_CONNECTED(bot.id), INSTANCE_ID, "EX", 120); // TTL 2 minutes, refreshed by ping
    }

    logger.info({ botId: bot.id, botName: bot.name, instance: INSTANCE_ID }, "Bot connected");

    ws.on("message", (data: Buffer) => {
      this.handleMessage(connectedBot, data.toString("utf-8"));
    });

    ws.on("close", () => {
      void this.handleDisconnect(connectedBot);
    });

    ws.on("error", (error) => {
      logger.error({ botId: bot.id, err: error }, "Bot WebSocket error");
      void this.handleDisconnect(connectedBot);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        botId: bot.id,
        botName: bot.name,
      })
    );
  }

  private handleMessage(bot: ConnectedBot, data: string): void {
    try {
      const message = JSON.parse(data) as BotToServer;

      switch (message.type) {
        case "debate_response":
          void this.handleDebateResponse(bot, message);
          break;

        case "response_chunk":
          this.handleResponseChunk(bot, message);
          break;

        case "pong":
          // Heartbeat acknowledged - refresh Redis TTL
          if (isRedisAvailable()) {
            void redis.expire(KEYS.BOT_CONNECTED(bot.botId), 120);
          }
          break;

        case "queue_join":
          void this.handleQueueJoin(bot, message);
          break;

        case "queue_leave":
          void this.handleQueueLeave(bot);
          break;

        default:
          logger.warn(
            { botId: bot.botId, type: (message as { type: string }).type },
            "Unknown message type from bot"
          );
      }
    } catch (error) {
      logger.error({ botId: bot.botId, err: error }, "Error parsing message from bot");
    }
  }

  private async handleDebateResponse(
    bot: ConnectedBot,
    message: DebateResponseMessage
  ): Promise<void> {
    logger.info(
      {
        botId: bot.botId,
        botName: bot.botName,
        requestId: message.requestId,
        messageLength: message.message?.length ?? 0,
      },
      "Received debate response from bot"
    );

    // First check if this is a local pending request
    const pending = this.pendingRequests.get(message.requestId);
    if (pending) {
      // Local request - resolve directly
      const parseResult = BotResponseSchema.safeParse({
        message: message.message,
        confidence: message.confidence,
      });

      if (!parseResult.success) {
        logger.error(
          { botId: bot.botId, requestId: message.requestId, error: parseResult.error.message },
          "Invalid bot response format"
        );
        pending.reject(new Error(`Invalid bot response: ${parseResult.error.message}`));
      } else {
        logger.info(
          { botId: bot.botId, requestId: message.requestId },
          "Successfully resolved bot response"
        );
        pending.resolve(parseResult.data);
      }

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);
      return;
    }

    // Not a local request - this might be from a cross-instance request
    // Forward response via Redis pub/sub
    if (isRedisAvailable()) {
      const parseResult = BotResponseSchema.safeParse({
        message: message.message,
        confidence: message.confidence,
      });

      if (!parseResult.success) {
        await this.sendResponseToInstance(message.requestId, undefined, parseResult.error.message);
      } else {
        await this.sendResponseToInstance(message.requestId, parseResult.data);
      }
    } else {
      logger.warn(
        { requestId: message.requestId, botId: bot.botId },
        "Received response for unknown request"
      );
    }
  }

  private handleResponseChunk(_bot: ConnectedBot, _message: ResponseChunkMessage): void {
    // Streaming support - can be implemented later for real-time message display
    // For now, we wait for the complete response
  }

  /**
   * Handle queue join request from a bot
   */
  private async handleQueueJoin(bot: ConnectedBot, message: QueueJoinMessage): Promise<void> {
    const { stake = 0, presetId = "classic" } = message;

    try {
      // Get full bot info including owner
      const botData = await botRepository.findById(bot.botId);
      if (!botData) {
        this.sendQueueError(bot, "Bot not found");
        return;
      }

      // Determine which presets to join
      const presetsToJoin = presetId === "all" ? getPresetIds() : [presetId];
      const queueIds: string[] = [];
      const joinedPresets: string[] = [];

      // Add to queue for each preset
      for (const preset of presetsToJoin) {
        try {
          const entry = await matchmaking.addToQueue(botData, botData.ownerId, stake, preset);
          queueIds.push(entry.id);
          joinedPresets.push(preset);
        } catch (err) {
          logger.warn({ botId: bot.botId, preset, err }, "Failed to join queue for preset");
        }
      }

      if (queueIds.length === 0) {
        this.sendQueueError(bot, "Failed to join any queues");
        return;
      }

      logger.info(
        { botId: bot.botId, botName: bot.botName, queueIds, stake, presets: joinedPresets },
        "Bot joined queues"
      );

      // Send confirmation
      const response: QueueJoinedMessage = {
        type: "queue_joined",
        queueIds,
        stake,
        presetIds: joinedPresets,
      };
      bot.ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error({ botId: bot.botId, err: error }, "Error adding bot to queue");
      this.sendQueueError(bot, error instanceof Error ? error.message : "Failed to join queue");
    }
  }

  /**
   * Handle queue leave request from a bot
   */
  private async handleQueueLeave(bot: ConnectedBot): Promise<void> {
    try {
      const removed = await matchmaking.removeFromQueue(bot.botId);

      if (removed) {
        logger.info({ botId: bot.botId, botName: bot.botName }, "Bot left queue");
      }

      const response: QueueLeftMessage = { type: "queue_left" };
      bot.ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error({ botId: bot.botId, err: error }, "Error removing bot from queue");
      this.sendQueueError(bot, error instanceof Error ? error.message : "Failed to leave queue");
    }
  }

  /**
   * Send queue error to bot
   */
  private sendQueueError(bot: ConnectedBot, error: string): void {
    const response: QueueErrorMessage = { type: "queue_error", error };
    bot.ws.send(JSON.stringify(response));
  }

  /**
   * Notify a bot that their debate has completed
   * Called by the debate orchestrator when a debate ends
   */
  notifyDebateComplete(
    botId: number,
    debateId: number,
    won: boolean | null,
    eloChange: number
  ): void {
    const bot = this.connectedBots.get(botId);
    if (!bot || bot.ws.readyState !== WebSocket.OPEN) {
      // Bot not connected locally - could send via Redis for cross-instance
      if (isRedisAvailable()) {
        void this.sendDebateCompleteViaRedis(botId, debateId, won, eloChange);
      }
      return;
    }

    const message: DebateCompleteMessage = {
      type: "debate_complete",
      debateId,
      won,
      eloChange,
    };
    bot.ws.send(JSON.stringify(message));
    logger.debug({ botId, debateId, won, eloChange }, "Sent debate_complete to bot");
  }

  /**
   * Send debate complete notification via Redis for cross-instance delivery
   */
  private async sendDebateCompleteViaRedis(
    botId: number,
    debateId: number,
    won: boolean | null,
    eloChange: number
  ): Promise<void> {
    const targetInstance = await redis.get(KEYS.BOT_CONNECTED(botId));
    if (!targetInstance) return;

    await redisPub.publish(
      `bot:instance:${targetInstance}`,
      JSON.stringify({
        type: "debate_complete_notification",
        botId,
        debateId,
        won,
        eloChange,
      })
    );
  }

  private async handleDisconnect(bot: ConnectedBot): Promise<void> {
    const current = this.connectedBots.get(bot.botId);
    // Only remove if it's the same connection (not replaced)
    if (current === bot) {
      this.connectedBots.delete(bot.botId);

      // Remove from Redis
      if (isRedisAvailable()) {
        await redis.del(KEYS.BOT_CONNECTED(bot.botId));
      }

      // Remove from matchmaking queue - disconnected bots shouldn't be matched
      const wasInQueue = await matchmaking.removeFromQueue(bot.botId);
      if (wasInQueue) {
        logger.info(
          { botId: bot.botId, botName: bot.botName },
          "Removed disconnected bot from matchmaking queue"
        );
      }

      logger.info({ botId: bot.botId, botName: bot.botName }, "Bot disconnected");
    }
  }

  private pingAll(): void {
    for (const [botId, bot] of this.connectedBots) {
      if (bot.ws.readyState === WebSocket.OPEN) {
        bot.ws.send(JSON.stringify({ type: "ping" } as PingMessage));

        // Refresh Redis TTL
        if (isRedisAvailable()) {
          void redis.expire(KEYS.BOT_CONNECTED(botId), 120);
        }
      } else {
        // Connection is not open, clean up
        this.connectedBots.delete(botId);
        if (isRedisAvailable()) {
          void redis.del(KEYS.BOT_CONNECTED(botId));
        }
        logger.debug({ botId }, "Cleaned up stale connection for bot");
      }
    }
  }

  /**
   * Check if a bot is currently connected via WebSocket (any instance)
   */
  async isConnected(botId: number): Promise<boolean> {
    // Check local first
    const localBot = this.connectedBots.get(botId);
    if (localBot && localBot.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    // Check Redis for cross-instance connections
    if (isRedisAvailable()) {
      const instanceId = await redis.get(KEYS.BOT_CONNECTED(botId));
      return instanceId !== null;
    }

    return false;
  }

  /**
   * Check if a bot is connected to THIS instance
   */
  isLocallyConnected(botId: number): boolean {
    const bot = this.connectedBots.get(botId);
    return bot !== undefined && bot.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a debate request to a connected bot and wait for response
   * Routes to correct instance via Redis if needed
   */
  async sendRequest(botId: number, request: BotRequest, timeout: number): Promise<BotResponse> {
    const requestId = `${INSTANCE_ID}-${botId}-${++this.requestCounter}-${Date.now()}`;

    // Check if bot is connected locally
    const localBot = this.connectedBots.get(botId);
    if (localBot) {
      if (localBot.ws.readyState === WebSocket.OPEN) {
        return this.sendLocalRequest(localBot, requestId, request, timeout);
      } else {
        logger.warn(
          {
            botId,
            botName: localBot.botName,
            wsReadyState: localBot.ws.readyState,
            round: request.round,
          },
          "Bot in connectedBots but WebSocket not OPEN"
        );
      }
    }

    // Check if bot is connected to another instance
    if (isRedisAvailable()) {
      const targetInstance = await redis.get(KEYS.BOT_CONNECTED(botId));
      if (targetInstance && targetInstance !== INSTANCE_ID) {
        return this.sendCrossInstanceRequest(targetInstance, botId, requestId, request, timeout);
      }
      logger.warn(
        { botId, round: request.round, redisInstance: targetInstance ?? "none" },
        "Bot not found locally or on another instance"
      );
    }

    throw new Error("Bot is not connected");
  }

  /**
   * Send request to a locally connected bot
   */
  private sendLocalRequest(
    bot: ConnectedBot,
    requestId: string,
    request: BotRequest,
    timeout: number
  ): Promise<BotResponse> {
    return new Promise<BotResponse>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        logger.error(
          {
            botId: bot.botId,
            botName: bot.botName,
            requestId,
            round: request.round,
            timeoutMs: timeout,
            wsReadyState: bot.ws.readyState,
          },
          "Bot request timed out - no response received"
        );
        reject(new Error(`Bot timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      const message: DebateRequestMessage = {
        type: "debate_request",
        requestId,
        ...request,
      };

      logger.info(
        {
          botId: bot.botId,
          botName: bot.botName,
          requestId,
          round: request.round,
          debateId: request.debate_id,
          timeoutMs: timeout,
        },
        "Sending debate request to bot"
      );

      bot.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Send request to a bot on another instance via Redis pub/sub
   */
  private async sendCrossInstanceRequest(
    targetInstance: string,
    botId: number,
    requestId: string,
    request: BotRequest,
    timeout: number
  ): Promise<BotResponse> {
    logger.info(
      { botId, requestId, targetInstance, round: request.round, timeoutMs: timeout },
      "Sending cross-instance debate request via Redis"
    );

    return new Promise<BotResponse>((resolve, reject) => {
      const responseChannel = KEYS.CHANNEL_BOT_RESPONSE(requestId);

      const timeoutHandle = setTimeout(() => {
        logger.error(
          { botId, requestId, targetInstance, round: request.round, timeoutMs: timeout },
          "Cross-instance bot request timed out"
        );
        void redisSub.unsubscribe(responseChannel);
        reject(new Error(`Bot timed out after ${timeout}ms`));
      }, timeout);

      // Subscribe to response channel
      const messageHandler = (channel: string, message: string) => {
        if (channel !== responseChannel) return;

        try {
          const data = JSON.parse(message) as BotResponsePubSubMessage;
          if (data.requestId === requestId) {
            clearTimeout(timeoutHandle);
            void redisSub.unsubscribe(responseChannel);
            redisSub.off("message", messageHandler);

            if (data.error) {
              logger.warn(
                { requestId, botId, error: data.error },
                "Received cross-instance error response"
              );
              reject(new Error(data.error));
            } else if (data.response) {
              logger.info(
                { requestId, botId, responseLength: data.response.message?.length ?? 0 },
                "Received cross-instance response successfully"
              );
              resolve(data.response);
            } else {
              logger.error({ requestId, botId }, "Invalid cross-instance response");
              reject(new Error("Invalid response from bot"));
            }
          }
        } catch (error) {
          logger.error({ err: error }, "Error parsing cross-instance response");
        }
      };

      redisSub.on("message", messageHandler);

      void (async () => {
        try {
          await redisSub.subscribe(responseChannel);

          // Send request to target instance
          const pubSubMessage: BotRequestPubSubMessage = {
            type: "bot_request",
            requestId,
            botId,
            request,
            timeout,
            sourceInstance: INSTANCE_ID,
          };

          await redisPub.publish(`bot:instance:${targetInstance}`, JSON.stringify(pubSubMessage));
        } catch (error) {
          clearTimeout(timeoutHandle);
          void redisSub.unsubscribe(responseChannel);
          redisSub.off("message", messageHandler);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    });
  }

  /**
   * Get stats about connected bots
   */
  getStats(): { connectedBots: number; pendingRequests: number } {
    return {
      connectedBots: this.connectedBots.size,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Get list of locally connected bot IDs
   */
  getConnectedBotIds(): number[] {
    return Array.from(this.connectedBots.keys());
  }
}

// Singleton instance - will be initialized in index.ts
let botConnectionServerInstance: BotConnectionServer | null = null;

export function initBotConnectionServer(): BotConnectionServer {
  if (botConnectionServerInstance) {
    throw new Error("BotConnectionServer already initialized");
  }
  botConnectionServerInstance = new BotConnectionServer();
  return botConnectionServerInstance;
}

export function getBotConnectionServer(): BotConnectionServer | null {
  return botConnectionServerInstance;
}
