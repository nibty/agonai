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

type BotToServer = DebateResponseMessage | ResponseChunkMessage | PongMessage;

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

    console.log(`[BotWS] Server initialized (instance: ${INSTANCE_ID})`);
  }

  /**
   * Initialize Redis pub/sub for cross-instance communication
   */
  private async initRedisSubscriptions(): Promise<void> {
    if (!isRedisAvailable()) {
      console.log("[BotWS] Redis not available, running in single-instance mode");
      return;
    }

    try {
      // Subscribe to bot request channel for this instance
      const instanceChannel = `bot:instance:${INSTANCE_ID}`;
      await redisSub.subscribe(instanceChannel);

      redisSub.on("message", (channel, message) => {
        if (channel === instanceChannel) {
          void this.handleRedisMessage(message);
        }
      });

      console.log(`[BotWS] Subscribed to Redis channel: ${instanceChannel}`);
    } catch (error) {
      console.error("[BotWS] Failed to subscribe to Redis:", error);
    }
  }

  /**
   * Handle messages from Redis pub/sub
   */
  private async handleRedisMessage(message: string): Promise<void> {
    try {
      const data = JSON.parse(message) as BotRequestPubSubMessage;

      if (data.type === "bot_request") {
        // Another instance is asking us to forward a request to a bot we have connected
        const bot = this.connectedBots.get(data.botId);
        if (!bot || bot.ws.readyState !== WebSocket.OPEN) {
          // Bot not connected to this instance anymore
          await this.sendResponseToInstance(data.requestId, undefined, "Bot not connected");
          return;
        }

        // Forward request to the bot
        const requestMessage: DebateRequestMessage = {
          type: "debate_request",
          requestId: data.requestId,
          ...data.request,
        };

        bot.ws.send(JSON.stringify(requestMessage));
      }
    } catch (error) {
      console.error("[BotWS] Error handling Redis message:", error);
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
      console.log(`[BotWS] Bot "${bot.name}" (${bot.id}) reconnecting, closing old connection`);
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

    console.log(`[BotWS] Bot "${bot.name}" (${bot.id}) connected to instance ${INSTANCE_ID}`);

    ws.on("message", (data: Buffer) => {
      this.handleMessage(connectedBot, data.toString("utf-8"));
    });

    ws.on("close", () => {
      void this.handleDisconnect(connectedBot);
    });

    ws.on("error", (error) => {
      console.error(`[BotWS] Error for bot ${bot.id}:`, error);
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

        default:
          console.warn(
            `[BotWS] Unknown message type from bot ${bot.botId}:`,
            (message as { type: string }).type
          );
      }
    } catch (error) {
      console.error(`[BotWS] Error parsing message from bot ${bot.botId}:`, error);
    }
  }

  private async handleDebateResponse(
    bot: ConnectedBot,
    message: DebateResponseMessage
  ): Promise<void> {
    // First check if this is a local pending request
    const pending = this.pendingRequests.get(message.requestId);
    if (pending) {
      // Local request - resolve directly
      const parseResult = BotResponseSchema.safeParse({
        message: message.message,
        confidence: message.confidence,
      });

      if (!parseResult.success) {
        pending.reject(new Error(`Invalid bot response: ${parseResult.error.message}`));
      } else {
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
      console.warn(
        `[BotWS] Received response for unknown request ${message.requestId} from bot ${bot.botId}`
      );
    }
  }

  private handleResponseChunk(_bot: ConnectedBot, _message: ResponseChunkMessage): void {
    // Streaming support - can be implemented later for real-time message display
    // For now, we wait for the complete response
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

      console.log(`[BotWS] Bot "${bot.botName}" (${bot.botId}) disconnected`);
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
        console.log(`[BotWS] Cleaned up stale connection for bot ${botId}`);
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
    if (localBot && localBot.ws.readyState === WebSocket.OPEN) {
      return this.sendLocalRequest(localBot, requestId, request, timeout);
    }

    // Check if bot is connected to another instance
    if (isRedisAvailable()) {
      const targetInstance = await redis.get(KEYS.BOT_CONNECTED(botId));
      if (targetInstance && targetInstance !== INSTANCE_ID) {
        return this.sendCrossInstanceRequest(targetInstance, botId, requestId, request, timeout);
      }
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
    return new Promise<BotResponse>((resolve, reject) => {
      const responseChannel = KEYS.CHANNEL_BOT_RESPONSE(requestId);

      const timeoutHandle = setTimeout(() => {
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
              reject(new Error(data.error));
            } else if (data.response) {
              resolve(data.response);
            } else {
              reject(new Error("Invalid response from bot"));
            }
          }
        } catch (error) {
          console.error("[BotWS] Error parsing cross-instance response:", error);
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
