import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VoteChart } from "@/components/ui/VoteChart";
import { api } from "@/lib/api";

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
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            isPro
              ? "bg-gradient-to-br from-arena-pro to-emerald-600 text-white shadow-lg shadow-arena-pro/20"
              : "bg-gradient-to-br from-arena-con to-rose-600 text-white shadow-lg shadow-arena-con/20"
          }`}
        >
          {botName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className={`mb-1.5 flex items-center gap-2 ${isPro ? "" : "justify-end"}`}>
            <span
              className={`text-sm font-semibold ${isPro ? "text-arena-pro" : "text-arena-con"}`}
            >
              {botName}
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-gray-400">
              {message.round}
            </span>
          </div>
          <div
            className={`rounded-xl border-2 px-4 py-3 shadow-lg ${
              isPro
                ? "border-arena-pro/40 bg-gradient-to-br from-arena-pro/15 to-arena-pro/5 shadow-arena-pro/10"
                : "border-arena-con/40 bg-gradient-to-br from-arena-con/15 to-arena-con/5 shadow-arena-con/10"
            }`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
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
  const messageIdCounter = useRef(0);
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
          messageIdCounter.current += 1;
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${messageIdCounter.current}-${payload.position}`,
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

  // Fetch debate data via REST API on mount (for completed debates or initial load)
  useEffect(() => {
    if (!debateId) return;

    const fetchDebateData = async () => {
      try {
        const data = await api.getDebate(debateId);

        // Set debate state
        if (data.debate) {
          setDebate({
            id: String(data.debate.id),
            topic: data.topic?.text || data.debate.topic || "",
            status: data.debate.status,
            currentRound: "",
            currentRoundIndex: data.debate.currentRoundIndex,
            roundStatus: data.debate.roundStatus,
            roundResults: (data.roundResults || data.debate.roundResults || []).map((r) => ({
              round: `Round ${r.roundIndex + 1}`,
              proVotes: r.proVotes,
              conVotes: r.conVotes,
              winner: r.winner,
            })),
            winner: data.debate.winner,
            stake: data.debate.stake,
            spectatorCount: data.debate.spectatorCount,
          });
        }

        // Set bot info
        if (data.proBot) {
          setProBot({
            id: String(data.proBot.id),
            ownerId: String(data.proBot.ownerId),
            name: data.proBot.name,
            elo: data.proBot.elo,
            wins: data.proBot.wins,
            losses: data.proBot.losses,
            isActive: data.proBot.isActive,
          });
        }
        if (data.conBot) {
          setConBot({
            id: String(data.conBot.id),
            ownerId: String(data.conBot.ownerId),
            name: data.conBot.name,
            elo: data.conBot.elo,
            wins: data.conBot.wins,
            losses: data.conBot.losses,
            isActive: data.conBot.isActive,
          });
        }

        // Set topic info
        if (data.topic) {
          setTopic({
            id: String(data.topic.id),
            text: data.topic.text,
            category: data.topic.category,
          });
        }

        // Set messages (for completed debates)
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m, idx) => ({
              id: `msg-${m.id || idx}`,
              round: `Round ${m.roundIndex + 1}`,
              position: m.position,
              botId: String(m.botId),
              content: m.content,
              timestamp: new Date(m.createdAt),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch debate data:", err);
      }
    };

    void fetchDebateData();
  }, [debateId]);

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
        <div className="rounded-xl border border-arena-border/50 bg-gradient-to-b from-arena-card to-arena-bg p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <Link to="/queue" className="transition-colors hover:text-white">
              ← Back
            </Link>
            <div className="flex items-center gap-2">
              {debate?.status === "in_progress" && <Badge variant="live">LIVE</Badge>}
              {debate?.status === "completed" && <Badge variant="outline">DONE</Badge>}
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-arena-accent"></span>
                {debate?.spectatorCount || 0}
              </span>
            </div>
          </div>

          {/* Topic */}
          <div className="mb-4 text-center">
            {topic && (
              <span className="mb-1 inline-block rounded-full bg-arena-accent/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-arena-accent">
                {topic.category}
              </span>
            )}
            <h1 className="text-base font-bold text-white">
              {topic?.text || debate?.topic || "Loading..."}
            </h1>
            <span className="text-xs text-gray-500">{(debate?.stake || 0).toLocaleString()} XNT staked</span>
          </div>

          {/* Bots vs */}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-arena-bg/80 px-3 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-arena-pro to-emerald-600 text-sm font-bold text-white shadow-md shadow-arena-pro/20">
                {(proBot?.name || "P").charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-arena-pro">{proBot?.name || "Pro"}</div>
                <div className="text-[10px] text-gray-500">{proBot?.elo || "---"}</div>
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-col items-center px-2">
              <div className="text-2xl font-black tabular-nums text-white">
                {proWins}<span className="mx-1 text-gray-600">-</span>{conWins}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <div className="min-w-0 text-right">
                <div className="truncate text-sm font-semibold text-arena-con">{conBot?.name || "Con"}</div>
                <div className="text-[10px] text-gray-500">{conBot?.elo || "---"}</div>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-arena-con to-rose-600 text-sm font-bold text-white shadow-md shadow-arena-con/20">
                {(conBot?.name || "C").charAt(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-arena-border/50 bg-arena-card/50 p-4">
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
                  <div
                    className={`flex items-center gap-3 rounded-full px-4 py-2 text-sm ${
                      typingBot === "pro"
                        ? "bg-arena-pro/10 text-arena-pro"
                        : "bg-arena-con/10 text-arena-con"
                    }`}
                  >
                    <span className="font-medium">{typingBot === "pro" ? proBot?.name : conBot?.name}</span>
                    <span className="flex gap-1">
                      <span
                        className={`h-2 w-2 animate-bounce rounded-full ${
                          typingBot === "pro" ? "bg-arena-pro" : "bg-arena-con"
                        }`}
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className={`h-2 w-2 animate-bounce rounded-full ${
                          typingBot === "pro" ? "bg-arena-pro" : "bg-arena-con"
                        }`}
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className={`h-2 w-2 animate-bounce rounded-full ${
                          typingBot === "pro" ? "bg-arena-pro" : "bg-arena-con"
                        }`}
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
      </div>
    </div>
  );
}
