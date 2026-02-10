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
        className={`max-w-[90%] ${isPro ? "order-1" : "order-2"} flex gap-2 ${
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
  const [votingTimeLeft, setVotingTimeLeft] = useState(0);
  const [votingDuration, setVotingDuration] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const votingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechQueueRef = useRef<{ text: string; position: "pro" | "con" }[]>([]);
  const speakRef = useRef<((text: string, position: "pro" | "con") => void) | null>(null);
  const processQueueRef = useRef<() => void>(() => {});

  // Process TTS queue
  processQueueRef.current = () => {
    const item = speechQueueRef.current.shift();
    if (!item) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const { text, position } = item;

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    if (position === "pro") {
      const maleVoice = voices.find(
        (v) => v.name.includes("Male") || v.name.includes("David") || v.name.includes("James")
      );
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 1.0;
    } else {
      const femaleVoice = voices.find(
        (v) =>
          v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Victoria")
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.pitch = 1.1;
    }

    utterance.rate = 1.1;
    utterance.onend = () => processQueueRef.current();
    utterance.onerror = () => processQueueRef.current();

    window.speechSynthesis.speak(utterance);
  };

  const speak = useCallback(
    (text: string, position: "pro" | "con") => {
      if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

      speechQueueRef.current.push({ text, position });

      if (!isSpeaking) {
        processQueueRef.current();
      }
    },
    [ttsEnabled, isSpeaking]
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  useEffect(() => {
    if (!ttsEnabled && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      setIsSpeaking(false);
    }
  }, [ttsEnabled]);

  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          speakRef.current?.(payload.content, payload.position);
          break;
        }

        case "voting_started": {
          const payload = msg.payload as { round: string; roundIndex: number; timeLimit: number };
          setDebate((prev) =>
            prev ? { ...prev, roundStatus: "voting", currentRound: payload.round, currentRoundIndex: payload.roundIndex } : null
          );
          setCurrentVotes({ pro: 0, con: 0 });
          setHasVoted(false);
          setSelectedVote(null);

          // Start voting countdown timer
          const duration = payload.timeLimit || 60;
          setVotingDuration(duration);
          setVotingTimeLeft(duration);

          // Clear any existing timer
          if (votingTimerRef.current) {
            clearInterval(votingTimerRef.current);
          }

          votingTimerRef.current = setInterval(() => {
            setVotingTimeLeft((prev) => {
              if (prev <= 1) {
                if (votingTimerRef.current) {
                  clearInterval(votingTimerRef.current);
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          break;
        }

        case "vote_update": {
          const payload = msg.payload as { proVotes: number; conVotes: number };
          setCurrentVotes({ pro: payload.proVotes, con: payload.conVotes });
          break;
        }

        case "round_ended": {
          const payload = msg.payload as { result: RoundResult };
          // Clear voting timer
          if (votingTimerRef.current) {
            clearInterval(votingTimerRef.current);
            votingTimerRef.current = null;
          }
          setVotingTimeLeft(0);
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

  useEffect(() => {
    if (!debateId) return;

    let isMounted = true;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted) return;
      setConnectionStatus("connected");
      setError(null);
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
      if (votingTimerRef.current) {
        clearInterval(votingTimerRef.current);
      }
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

  const proWins = debate?.roundResults.filter((r) => r.winner === "pro").length || 0;
  const conWins = debate?.roundResults.filter((r) => r.winner === "con").length || 0;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-theme(spacing.16)-theme(spacing.16))] lg:flex-row">
      {/* Left Sidebar - Score & Voting */}
      <div className="flex w-full flex-shrink-0 flex-col gap-3 lg:w-72">
        {/* Match Info Card */}
        <div className="rounded-lg border border-arena-border/50 bg-arena-card/50 p-3">
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <Link to="/queue" className="transition-colors hover:text-white">
              ← Back
            </Link>
            <div className="flex items-center gap-2">
              {debate?.status === "in_progress" && <Badge variant="live">LIVE</Badge>}
              {debate?.status === "completed" && <Badge variant="outline">DONE</Badge>}
              <span>{debate?.spectatorCount || 0} watching</span>
            </div>
          </div>

          {/* Topic */}
          <div className="mb-3 text-center">
            {topic && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {topic.category}
              </span>
            )}
            <h1 className="text-sm font-semibold text-white">
              {topic?.text || debate?.topic || "Loading..."}
            </h1>
            <span className="text-[10px] text-gray-500">{(debate?.stake || 0).toLocaleString()} XNT</span>
          </div>

          {/* Bots vs */}
          <div className="flex items-center justify-between rounded bg-arena-bg/50 p-2">
            <div className="flex items-center gap-2">
              <BotAvatar size="sm" alt={proBot?.name || "Pro"} tier={3} />
              <div>
                <div className="text-xs font-medium text-arena-pro">{proBot?.name || "Pro"}</div>
                <div className="text-[10px] text-gray-500">{proBot?.elo || "---"}</div>
              </div>
            </div>
            <div className="text-lg font-bold text-white">
              {proWins} - {conWins}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs font-medium text-arena-con">{conBot?.name || "Con"}</div>
                <div className="text-[10px] text-gray-500">{conBot?.elo || "---"}</div>
              </div>
              <BotAvatar size="sm" alt={conBot?.name || "Con"} tier={3} />
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-arena-border/50 bg-arena-card/50 p-3">
          <VoteChart
            roundResults={debate?.roundResults || []}
            currentVotes={currentVotes}
            currentRound={debate?.currentRound}
            isVoting={debate?.roundStatus === "voting"}
          />
        </div>

        {/* Voting Panel */}
        {debate?.roundStatus === "voting" && (
          <div className="rounded-lg border border-arena-accent/50 bg-arena-accent/5 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-white">Vote Now - {debate.currentRound}</span>
              <span className="text-xs text-gray-400">{votingTimeLeft}s</span>
            </div>

            {/* Time progress bar */}
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-arena-bg/50">
              <div
                className="h-full rounded-full bg-arena-accent transition-all duration-1000 ease-linear"
                style={{ width: `${votingDuration > 0 ? (votingTimeLeft / votingDuration) * 100 : 0}%` }}
              />
            </div>

            {connected ? (
              <div className="flex gap-2">
                <Button
                  variant="pro"
                  size="sm"
                  disabled={hasVoted}
                  onClick={() => handleVote("pro")}
                  className={`flex-1 ${hasVoted && selectedVote !== "pro" ? "opacity-40" : ""}`}
                >
                  PRO {hasVoted && selectedVote === "pro" && "✓"}
                </Button>
                <Button
                  variant="con"
                  size="sm"
                  disabled={hasVoted}
                  onClick={() => handleVote("con")}
                  className={`flex-1 ${hasVoted && selectedVote !== "con" ? "opacity-40" : ""}`}
                >
                  CON {hasVoted && selectedVote === "con" && "✓"}
                </Button>
              </div>
            ) : (
              <div className="text-center text-xs text-gray-400">Connect wallet to vote</div>
            )}
            {hasVoted && (
              <div className="mt-2 text-center text-xs text-gray-400">
                Current: {currentVotes.pro} - {currentVotes.con}
              </div>
            )}
          </div>
        )}

        {/* Winner Banner */}
        {debate?.status === "completed" && debate.winner && (
          <div
            className={`rounded-lg border p-3 text-center ${
              debate.winner === "pro"
                ? "border-arena-pro/50 bg-arena-pro/10"
                : "border-arena-con/50 bg-arena-con/10"
            }`}
          >
            <div className="text-sm font-semibold text-white">
              {debate.winner === "pro" ? proBot?.name : conBot?.name} Wins!
            </div>
            <div className="text-xs text-gray-400">
              Final: {proWins} - {conWins}
            </div>
          </div>
        )}

        {/* TTS Toggle */}
        <button
          onClick={() => setTtsEnabled(!ttsEnabled)}
          className={`rounded-lg border p-2 text-xs transition-colors ${
            ttsEnabled
              ? "border-arena-accent/50 bg-arena-accent/10 text-arena-accent"
              : "border-arena-border/50 text-gray-500 hover:text-gray-300"
          }`}
        >
          {ttsEnabled ? (isSpeaking ? "🔊 Speaking..." : "🔊 TTS On") : "🔇 TTS Off"}
        </button>
      </div>

      {/* Main Content - Debate Feed */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Current Round Indicator */}
        <div className="mb-2 flex items-center justify-center gap-2 text-xs">
          <span className="text-gray-500">{debate?.currentRound || "Waiting..."}</span>
          {debate?.roundStatus === "bot_responding" && (
            <span className="text-yellow-500">● Bots debating</span>
          )}
          {debate?.roundStatus === "voting" && (
            <span className="text-arena-accent">● Voting open</span>
          )}
        </div>

        {/* Messages */}
        <div className="relative min-h-[400px] flex-1 overflow-hidden rounded-lg border border-arena-border/50 bg-arena-card/30 lg:min-h-0">
          <div className="absolute inset-0 overflow-y-auto p-4 scrollbar-hide">
            <div className="space-y-3">
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

              {typingBot && (
                <div className={`flex ${typingBot === "pro" ? "justify-start" : "justify-end"}`}>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{typingBot === "pro" ? proBot?.name : conBot?.name} is typing</span>
                    <span className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
