import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { VoteChart } from "@/components/ui/VoteChart";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

// Types matching backend
interface BotInfo {
  id: string;
  ownerId: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  isActive: boolean;
}

interface TopicInfo {
  id: string;
  text: string;
  category: string;
}

interface RoundResult {
  round: string;
  proVotes: number;
  conVotes: number;
  winner: "pro" | "con";
}

interface DebateState {
  id: string;
  topic: string;
  status: string;
  currentRound: string;
  currentRoundIndex: number;
  roundStatus: string;
  roundResults: RoundResult[];
  winner: "pro" | "con" | null;
  stake: number;
  spectatorCount: number;
}

interface DebateMessage {
  id: string;
  round: string;
  position: "pro" | "con";
  botId: string;
  content: string;
  timestamp: Date;
}

function MessageBubble({ message, botName }: { message: DebateMessage; botName: string }) {
  const isPro = message.position === "pro";

  return (
    <div className={`flex ${isPro ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] ${isPro ? "order-1" : "order-2"} flex gap-3 ${
          isPro ? "" : "flex-row-reverse"
        }`}
      >
        <BotAvatar size="sm" alt={botName} tier={3} className="flex-shrink-0" />
        <div>
          <div className={`mb-1 flex items-center gap-1.5 ${isPro ? "" : "justify-end"}`}>
            <span
              className={`text-xs font-medium ${isPro ? "text-arena-pro" : "text-arena-con"}`}
            >
              {botName}
            </span>
            <span className="text-[10px] uppercase text-gray-500">{message.round}</span>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 ${
              isPro
                ? "border-arena-pro/30 bg-arena-pro/5"
                : "border-arena-con/30 bg-arena-con/5"
            }`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArenaPage() {
  const { debateId } = useParams<{ debateId: string }>();
  const { connected, publicKey } = useWallet();
  const [debate, setDebate] = useState<DebateState | null>(null);
  const [proBot, setProBot] = useState<BotInfo | null>(null);
  const [conBot, setConBot] = useState<BotInfo | null>(null);
  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [currentVotes, setCurrentVotes] = useState({ pro: 0, con: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedVote, setSelectedVote] = useState<"pro" | "con" | null>(null);
  const [typingBot, setTypingBot] = useState<"pro" | "con" | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechQueueRef = useRef<{ text: string; position: "pro" | "con" }[]>([]);
  const speakRef = useRef<((text: string, position: "pro" | "con") => void) | null>(null);
  const processQueueRef = useRef<() => void>(() => {});

  // Process TTS queue - uses ref to avoid circular dependency
  processQueueRef.current = () => {
    const item = speechQueueRef.current.shift();
    if (!item) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const { text, position } = item;

    const utterance = new SpeechSynthesisUtterance(text);

    // Get available voices
    const voices = window.speechSynthesis.getVoices();

    // Try to use different voices for pro/con
    if (position === "pro") {
      // Try to find a male voice for pro
      const maleVoice = voices.find(
        (v) => v.name.includes("Male") || v.name.includes("David") || v.name.includes("James")
      );
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 1.0;
    } else {
      // Try to find a female voice for con
      const femaleVoice = voices.find(
        (v) =>
          v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Victoria")
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.pitch = 1.1;
    }

    utterance.rate = 1.1; // Slightly faster
    utterance.onend = () => processQueueRef.current();
    utterance.onerror = () => processQueueRef.current();

    window.speechSynthesis.speak(utterance);
  };

  // Text-to-speech function
  const speak = useCallback(
    (text: string, position: "pro" | "con") => {
      if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

      // Add to queue
      speechQueueRef.current.push({ text, position });

      // If not currently speaking, start processing queue
      if (!isSpeaking) {
        processQueueRef.current();
      }
    },
    [ttsEnabled, isSpeaking]
  );

  // Load voices when available
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices(); // Trigger voice loading
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Stop speech when TTS is disabled
  useEffect(() => {
    if (!ttsEnabled && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      setIsSpeaking(false);
    }
  }, [ttsEnabled]);

  // Keep speak ref updated
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback(
    (msg: { type: string; payload?: unknown; debateId?: string }) => {
      console.log("WS message:", msg.type, msg.payload);

      switch (msg.type) {
        case "debate_state": {
          const payload = msg.payload as { debate: DebateState };
          setDebate(payload.debate);
          break;
        }

        case "debate_started": {
          const payload = msg.payload as {
            debate: DebateState;
            proBot: BotInfo;
            conBot: BotInfo;
            topic: TopicInfo;
          };
          setDebate(payload.debate);
          setProBot(payload.proBot);
          setConBot(payload.conBot);
          setTopic(payload.topic);
          break;
        }

        case "round_started": {
          const payload = msg.payload as { round: string; roundIndex: number };
          setDebate((prev) =>
            prev ? { ...prev, currentRound: payload.round, currentRoundIndex: payload.roundIndex, roundStatus: "bot_responding" } : null
          );
          setTypingBot(null);
          break;
        }

        case "bot_typing": {
          const payload = msg.payload as { position: "pro" | "con" };
          setTypingBot(payload.position);
          break;
        }

        case "bot_message": {
          const payload = msg.payload as {
            round: string;
            position: "pro" | "con";
            botId: string;
            content: string;
          };
          setTypingBot(null);
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${payload.position}`,
              round: payload.round,
              position: payload.position,
              botId: payload.botId,
              content: payload.content,
              timestamp: new Date(),
            },
          ]);
          // Speak the message (uses ref to avoid dependency issues)
          speakRef.current?.(payload.content, payload.position);
          break;
        }

        case "voting_started": {
          const payload = msg.payload as { round: string; roundIndex: number };
          setDebate((prev) =>
            prev ? { ...prev, roundStatus: "voting", currentRound: payload.round, currentRoundIndex: payload.roundIndex } : null
          );
          setCurrentVotes({ pro: 0, con: 0 });
          setHasVoted(false);
          setSelectedVote(null);
          break;
        }

        case "vote_update": {
          const payload = msg.payload as { proVotes: number; conVotes: number };
          setCurrentVotes({ pro: payload.proVotes, con: payload.conVotes });
          break;
        }

        case "round_ended": {
          const payload = msg.payload as { result: RoundResult };
          setDebate((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              roundStatus: "completed",
              roundResults: [...prev.roundResults, payload.result],
            };
          });
          break;
        }

        case "debate_ended": {
          const payload = msg.payload as {
            winner: "pro" | "con";
            finalScore: { pro: number; con: number };
          };
          setDebate((prev) =>
            prev ? { ...prev, status: "completed", winner: payload.winner } : null
          );
          break;
        }

        case "spectator_count": {
          const payload = msg.payload as { count: number };
          setDebate((prev) => (prev ? { ...prev, spectatorCount: payload.count } : null));
          break;
        }

        case "vote_accepted": {
          setHasVoted(true);
          break;
        }

        case "error": {
          const payload = msg.payload as { message: string };
          console.error("WS error:", payload.message);
          break;
        }
      }
    },
    []
  );

  // WebSocket connection
  useEffect(() => {
    if (!debateId) return;

    let isMounted = true;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted) return;
      setConnectionStatus("connected");
      setError(null);
      // Join the debate
      ws.send(
        JSON.stringify({
          type: "join_debate",
          payload: { debateId, userId: publicKey || undefined },
        })
      );
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    ws.onclose = () => {
      if (!isMounted) return;
      setConnectionStatus((prev) => (prev === "connected" ? "disconnected" : prev));
    };

    ws.onerror = () => {
      if (!isMounted) return;
      setConnectionStatus((prev) => {
        if (prev === "connected") return prev;
        setError("WebSocket connection failed");
        return "disconnected";
      });
    };

    return () => {
      isMounted = false;
      ws.close();
    };
  }, [debateId, publicKey, handleWSMessage]);

  const handleVote = (position: "pro" | "con") => {
    if (!connected || !debateId || hasVoted || !debate) return;

    setSelectedVote(position);

    wsRef.current?.send(
      JSON.stringify({
        type: "submit_vote",
        payload: {
          debateId,
          roundIndex: debate.currentRoundIndex,
          choice: position,
        },
      })
    );
  };

  // Loading state
  if (connectionStatus === "connecting") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-arena-accent border-t-transparent"></div>
          <p className="text-gray-400">Connecting to debate...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || connectionStatus === "disconnected") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="p-8 text-center">
          <p className="mb-4 text-arena-con">{error || "Disconnected from server"}</p>
          <Link to="/queue">
            <Button>Back to Queue</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.16))] flex-col">
      {/* Compact Header Bar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-arena-border/50 pb-2">
        <div className="flex items-center gap-4">
          <Link to="/queue" className="text-sm text-gray-400 transition-colors hover:text-white">
            ← Back
          </Link>
          <div className="h-4 w-px bg-arena-border" />
          {debate?.status === "in_progress" && <Badge variant="live">LIVE</Badge>}
          {debate?.status === "completed" && <Badge variant="outline">COMPLETED</Badge>}
          <span className="text-xs text-gray-500">{debate?.spectatorCount || 0} watching</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              ttsEnabled
                ? "bg-arena-accent/20 text-arena-accent"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {ttsEnabled ? (isSpeaking ? "Speaking..." : "TTS On") : "TTS Off"}
          </button>
        </div>
      </div>

      {/* Topic + Bots Row */}
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-arena-border/30 py-3">
        {/* PRO Bot */}
        <div className="flex items-center gap-2">
          <BotAvatar size="sm" alt={proBot?.name || "Pro"} tier={3} />
          <div className="text-sm">
            <span className="font-semibold text-arena-pro">{proBot?.name || "Pro Bot"}</span>
            <span className="ml-1.5 text-xs text-gray-500">{proBot?.elo || "---"}</span>
          </div>
        </div>

        {/* Topic - Center */}
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          {topic && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {topic.category}
            </span>
          )}
          <h1 className="max-w-2xl truncate text-sm font-semibold text-white">
            {topic?.text || debate?.topic || "Loading..."}
          </h1>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="uppercase">{debate?.currentRound || "pending"}</span>
            <span className="h-1 w-1 rounded-full bg-gray-600" />
            <span>{(debate?.stake || 0).toLocaleString()} XNT</span>
          </div>
        </div>

        {/* CON Bot */}
        <div className="flex items-center gap-2">
          <div className="text-right text-sm">
            <span className="font-semibold text-arena-con">{conBot?.name || "Con Bot"}</span>
            <span className="ml-1.5 text-xs text-gray-500">{conBot?.elo || "---"}</span>
          </div>
          <BotAvatar size="sm" alt={conBot?.name || "Con"} tier={3} />
        </div>
      </div>

      {/* Vote Chart */}
      <div className="flex-shrink-0 py-2">
        <VoteChart
          roundResults={debate?.roundResults || []}
          currentVotes={currentVotes}
          currentRound={debate?.currentRound}
          isVoting={debate?.roundStatus === "voting"}
        />
      </div>

      {/* Debate Feed - Takes remaining space */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-arena-border/50 bg-arena-card/50">
        <div className="absolute inset-0 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center py-20 text-sm text-gray-500">
                Waiting for debate to start...
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                botName={
                  message.position === "pro" ? proBot?.name || "Pro Bot" : conBot?.name || "Con Bot"
                }
              />
            ))}

            {/* Typing indicator */}
            {typingBot && (
              <div className={`flex ${typingBot === "pro" ? "justify-start" : "justify-end"}`}>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{typingBot === "pro" ? proBot?.name : conBot?.name} is typing</span>
                  <span className="flex gap-0.5">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Bottom Bar: Voting or Results */}
      <div className="flex-shrink-0 pt-3">
        {/* Voting Section */}
        {debate?.roundStatus === "voting" && (
          <div className="flex items-center justify-between rounded-lg border border-arena-accent/50 bg-arena-accent/5 px-4 py-3">
            <div className="text-sm">
              <span className="font-medium text-white">Vote Now</span>
              <span className="ml-2 text-xs text-gray-400">
                {hasVoted ? `Voted ${selectedVote?.toUpperCase()}` : debate.currentRound}
              </span>
            </div>
            {connected ? (
              <div className="flex gap-2">
                <Button
                  variant="pro"
                  size="sm"
                  disabled={hasVoted}
                  onClick={() => handleVote("pro")}
                  className={hasVoted && selectedVote !== "pro" ? "opacity-40" : ""}
                >
                  PRO
                </Button>
                <Button
                  variant="con"
                  size="sm"
                  disabled={hasVoted}
                  onClick={() => handleVote("con")}
                  className={hasVoted && selectedVote !== "con" ? "opacity-40" : ""}
                >
                  CON
                </Button>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Connect wallet to vote</span>
            )}
          </div>
        )}

        {/* Winner Banner */}
        {debate?.status === "completed" && debate.winner && (
          <div
            className={`rounded-lg border px-4 py-3 text-center ${
              debate.winner === "pro"
                ? "border-arena-pro/50 bg-arena-pro/10"
                : "border-arena-con/50 bg-arena-con/10"
            }`}
          >
            <span className="font-semibold text-white">
              {debate.winner === "pro" ? proBot?.name : conBot?.name} Wins!
            </span>
            <span className="ml-2 text-sm text-gray-400">
              {debate.roundResults.filter((r) => r.winner === "pro").length} -{" "}
              {debate.roundResults.filter((r) => r.winner === "con").length}
            </span>
          </div>
        )}

        {/* Round Results - Compact inline */}
        {debate && debate.roundResults.length > 0 && debate.status !== "completed" && (
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-500">
            {debate.roundResults.map((result, index) => (
              <div key={index} className="flex items-center gap-1">
                <span className="capitalize">{result.round}:</span>
                <span className={result.winner === "pro" ? "text-arena-pro" : "text-arena-con"}>
                  {result.winner.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
