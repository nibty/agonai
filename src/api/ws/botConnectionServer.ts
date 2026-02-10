import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { BotRequest, BotResponse } from "../types/index.js";
import { BotResponseSchema } from "../types/index.js";
import { botRepository } from "../repositories/index.js";

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

type ServerToBot = DebateRequestMessage | PingMessage;
type BotToServer = DebateResponseMessage | ResponseChunkMessage | PongMessage;

/**
 * WebSocket Server for Bot Connections
 *
 * Allows bots to connect TO the debate server via WebSocket
 * instead of exposing HTTP endpoints. This enables bots to run
 * behind NATs/firewalls and receive real-time notifications.
 *
 * URL Format: ws://host/bot/connect/{connectionToken}
 */
export class BotConnectionServer {
  private wss: WebSocketServer;
  private connectedBots: Map<number, ConnectedBot> = new Map(); // botId -> connection
  private pendingRequests: Map<string, PendingRequest> = new Map(); // requestId -> pending
  private requestCounter = 0;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: /^\/bot\/connect\/[a-f0-9]{64}$/,
    });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Ping connected bots every 30 seconds
    setInterval(() => this.pingAll(), 30000);

    console.log("Bot WebSocket server initialized on /bot/connect/:token");
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = req.url ?? "";
    const tokenMatch = url.match(/^\/bot\/connect\/([a-f0-9]{64})$/);

    if (!tokenMatch) {
      ws.close(4001, "Invalid connection URL");
      return;
    }

    const token = tokenMatch[1];

    // Validate token and get bot
    const bot = await botRepository.findByConnectionToken(token);
    if (!bot) {
      ws.close(4002, "Invalid connection token");
      return;
    }

    // Check if bot is already connected
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
    console.log(`[BotWS] Bot "${bot.name}" (${bot.id}) connected`);

    ws.on("message", (data) => {
      this.handleMessage(connectedBot, data.toString());
    });

    ws.on("close", () => {
      this.handleDisconnect(connectedBot);
    });

    ws.on("error", (error) => {
      console.error(`[BotWS] Error for bot ${bot.id}:`, error);
      this.handleDisconnect(connectedBot);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: "connected",
      botId: bot.id,
      botName: bot.name,
    }));
  }

  private handleMessage(bot: ConnectedBot, data: string): void {
    try {
      const message = JSON.parse(data) as BotToServer;

      switch (message.type) {
        case "debate_response":
          this.handleDebateResponse(bot, message);
          break;

        case "response_chunk":
          this.handleResponseChunk(bot, message);
          break;

        case "pong":
          // Heartbeat acknowledged
          break;

        default:
          console.warn(`[BotWS] Unknown message type from bot ${bot.botId}:`, (message as { type: string }).type);
      }
    } catch (error) {
      console.error(`[BotWS] Error parsing message from bot ${bot.botId}:`, error);
    }
  }

  private handleDebateResponse(bot: ConnectedBot, message: DebateResponseMessage): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      console.warn(`[BotWS] Received response for unknown request ${message.requestId} from bot ${bot.botId}`);
      return;
    }

    // Validate response
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
  }

  private handleResponseChunk(_bot: ConnectedBot, _message: ResponseChunkMessage): void {
    // Streaming support - can be implemented later for real-time message display
    // For now, we wait for the complete response
  }

  private handleDisconnect(bot: ConnectedBot): void {
    const current = this.connectedBots.get(bot.botId);
    // Only remove if it's the same connection (not replaced)
    if (current === bot) {
      this.connectedBots.delete(bot.botId);
      console.log(`[BotWS] Bot "${bot.botName}" (${bot.botId}) disconnected`);
    }
  }

  private pingAll(): void {
    for (const [botId, bot] of this.connectedBots) {
      if (bot.ws.readyState === WebSocket.OPEN) {
        bot.ws.send(JSON.stringify({ type: "ping" } as PingMessage));
      } else {
        // Connection is not open, clean up
        this.connectedBots.delete(botId);
        console.log(`[BotWS] Cleaned up stale connection for bot ${botId}`);
      }
    }
  }

  /**
   * Check if a bot is currently connected via WebSocket
   */
  isConnected(botId: number): boolean {
    const bot = this.connectedBots.get(botId);
    return bot !== undefined && bot.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a debate request to a connected bot and wait for response
   */
  async sendRequest(botId: number, request: BotRequest, timeout: number): Promise<BotResponse> {
    const bot = this.connectedBots.get(botId);
    if (!bot || bot.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Bot is not connected");
    }

    const requestId = `${botId}-${++this.requestCounter}-${Date.now()}`;

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
   * Get stats about connected bots
   */
  getStats(): { connectedBots: number; pendingRequests: number } {
    return {
      connectedBots: this.connectedBots.size,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Get list of connected bot IDs
   */
  getConnectedBotIds(): number[] {
    return Array.from(this.connectedBots.keys());
  }
}

// Singleton instance - will be initialized in index.ts
let botConnectionServerInstance: BotConnectionServer | null = null;

export function initBotConnectionServer(server: Server): BotConnectionServer {
  if (botConnectionServerInstance) {
    throw new Error("BotConnectionServer already initialized");
  }
  botConnectionServerInstance = new BotConnectionServer(server);
  return botConnectionServerInstance;
}

export function getBotConnectionServer(): BotConnectionServer | null {
  return botConnectionServerInstance;
}
