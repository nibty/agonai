/**
 * WebSocket Client for real-time debate updates
 */

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

type DebateRound = "opening" | "rebuttal" | "closing";
type DebatePosition = "pro" | "con";

interface WSMessage {
  type: string;
  debateId?: string;
  payload?: unknown;
}

interface DebateStartedPayload {
  debate: {
    id: string;
    topic: string;
    status: string;
  };
  proBot: {
    id: string;
    name: string;
    elo: number;
  };
  conBot: {
    id: string;
    name: string;
    elo: number;
  };
  topic: {
    id: string;
    text: string;
    category: string;
  };
}

interface RoundStartedPayload {
  round: DebateRound;
  timeLimit: number;
}

interface BotMessagePayload {
  round: DebateRound;
  position: DebatePosition;
  botId: string;
  content: string;
  isComplete: boolean;
}

interface BotTypingPayload {
  position: DebatePosition;
  botId: string;
}

interface VotingStartedPayload {
  round: DebateRound;
  timeLimit: number;
}

interface VoteUpdatePayload {
  round: DebateRound;
  proVotes: number;
  conVotes: number;
}

interface RoundEndedPayload {
  round: DebateRound;
  result: {
    round: DebateRound;
    proVotes: number;
    conVotes: number;
    winner: DebatePosition;
  };
  overallScore: { pro: number; con: number };
}

interface DebateEndedPayload {
  winner: DebatePosition;
  finalScore: { pro: number; con: number };
  eloChanges: {
    proBot: { oldElo: number; newElo: number; change: number };
    conBot: { oldElo: number; newElo: number; change: number };
  };
  payouts: Array<{ bettorId: string; amount: number }>;
}

interface SpectatorCountPayload {
  count: number;
}

interface ErrorPayload {
  code: string;
  message: string;
}

type MessageHandler = (message: WSMessage) => void;

class DebateWebSocket {
  private ws: WebSocket | null = null;
  private currentDebateId: string | null = null;
  private userId: string | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_BASE);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(new Error("WebSocket connection failed"));
        };
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Unknown connection error"));
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect()
        .then(() => {
          // Rejoin debate if we were watching one
          if (this.currentDebateId) {
            this.joinDebate(this.currentDebateId, this.userId ?? undefined);
          }
        })
        .catch((err: unknown) => {
          console.error("Reconnection failed:", err);
        });
    }, delay);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentDebateId = null;
    this.userId = null;
  }

  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: WSMessage): void {
    // Notify all handlers for this message type
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(message);
      }
    }

    // Notify catch-all handlers
    const allHandlers = this.handlers.get("*");
    if (allHandlers) {
      for (const handler of allHandlers) {
        handler(message);
      }
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const handlers = this.handlers.get(type);
    handlers?.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  // Debate operations
  joinDebate(debateId: string, userId?: string): void {
    this.currentDebateId = debateId;
    this.userId = userId ?? null;

    this.send({
      type: "join_debate",
      payload: { debateId, userId },
    });
  }

  leaveDebate(): void {
    if (this.currentDebateId) {
      this.send({ type: "leave_debate" });
      this.currentDebateId = null;
    }
  }

  submitVote(round: DebateRound, choice: DebatePosition): void {
    if (!this.currentDebateId) return;

    this.send({
      type: "submit_vote",
      payload: {
        debateId: this.currentDebateId,
        round,
        choice,
      },
    });
  }

  ping(): void {
    this.send({ type: "ping" });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get debateId(): string | null {
    return this.currentDebateId;
  }
}

// Export singleton instance
export const debateWS = new DebateWebSocket();

// Export types
export type {
  WSMessage,
  DebateStartedPayload,
  RoundStartedPayload,
  BotMessagePayload,
  BotTypingPayload,
  VotingStartedPayload,
  VoteUpdatePayload,
  RoundEndedPayload,
  DebateEndedPayload,
  SpectatorCountPayload,
  ErrorPayload,
};
