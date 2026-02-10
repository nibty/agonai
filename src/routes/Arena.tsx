import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/Card";
import { Badge, TierBadge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { DualProgress, Progress } from "@/components/ui/Progress";

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

function MessageBubble({
  message,
  botName,
}: {
  message: DebateMessage;
  botName: string;
}) {
  const isPro = message.position === "pro";

  return (
    <div className={`flex ${isPro ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] ${isPro ? "order-1" : "order-2"} flex gap-3 ${
          isPro ? "" : "flex-row-reverse"
        }`}
      >
        <BotAvatar
          size="sm"
          alt={botName}
          tier={3}
          className="flex-shrink-0"
        />
        <div>
          <div
            className={`flex items-center gap-2 mb-1 ${
              isPro ? "" : "justify-end"
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isPro ? "text-arena-pro" : "text-arena-con"
              }`}
            >
              {botName}
            </span>
            <Badge variant={isPro ? "pro" : "con"} className="text-xs">
              {message.position.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {message.round}
            </Badge>
          </div>
          <Card variant={isPro ? "pro" : "con"} className="p-4">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BotInfoPanel({
  bot,
  position,
  votes,
  totalVotes,
}: {
  bot: BotInfo | null;
  position: "pro" | "con";
  votes: number;
  totalVotes: number;
}) {
  const isPro = position === "pro";
  const votePercentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 50;

  if (!bot) {
    return (
      <Card variant={isPro ? "pro" : "con"}>
        <CardContent className="animate-pulse">
          <div className="h-16 bg-arena-border rounded mb-4"></div>
          <div className="h-4 bg-arena-border rounded w-3/4"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant={isPro ? "pro" : "con"}>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <BotAvatar size="lg" alt={bot.name} tier={3} />
          <div>
            <div
              className={`font-semibold ${
                isPro ? "text-arena-pro" : "text-arena-con"
              }`}
            >
              {bot.name}
            </div>
            <div className="text-sm text-gray-400">ELO {bot.elo}</div>
            <div className="flex gap-1 mt-1">
              <TierBadge tier={3} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="text-white font-medium">{bot.wins}</div>
            <div className="text-gray-400">Wins</div>
          </div>
          <div>
            <div className="text-white font-medium">{bot.losses}</div>
            <div className="text-gray-400">Losses</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Current Votes</span>
            <span className="text-white font-medium">{votePercentage.toFixed(1)}%</span>
          </div>
          <Progress
            value={votePercentage}
            variant={isPro ? "pro" : "con"}
          />
        </div>
      </CardContent>
    </Card>
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
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechQueueRef = useRef<{ text: string; position: "pro" | "con" }[]>([]);
  const speakRef = useRef<((text: string, position: "pro" | "con") => void) | null>(null);

  // Text-to-speech function
  const speak = useCallback((text: string, position: "pro" | "con") => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    // Add to queue
    speechQueueRef.current.push({ text, position });

    // If not currently speaking, start processing queue
    if (!isSpeaking) {
      processQueue();
    }
  }, [ttsEnabled, isSpeaking]);

  const processQueue = useCallback(() => {
    if (speechQueueRef.current.length === 0) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const { text, position } = speechQueueRef.current.shift()!;

    const utterance = new SpeechSynthesisUtterance(text);

    // Get available voices
    const voices = window.speechSynthesis.getVoices();

    // Try to use different voices for pro/con
    if (position === "pro") {
      // Try to find a male voice for pro
      const maleVoice = voices.find(v => v.name.includes("Male") || v.name.includes("David") || v.name.includes("James"));
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 1.0;
    } else {
      // Try to find a female voice for con
      const femaleVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Victoria"));
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.pitch = 1.1;
    }

    utterance.rate = 1.1; // Slightly faster
    utterance.onend = () => processQueue();
    utterance.onerror = () => processQueue();

    window.speechSynthesis.speak(utterance);
  }, []);

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
  const handleWSMessage = useCallback((msg: { type: string; payload?: unknown; debateId?: string }) => {
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
        const payload = msg.payload as { round: string };
        setDebate((prev) => prev ? { ...prev, currentRound: payload.round, roundStatus: "bot_responding" } : null);
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
        const payload = msg.payload as { round: string };
        setDebate((prev) => prev ? { ...prev, roundStatus: "voting", currentRound: payload.round } : null);
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
        setDebate((prev) => prev ? { ...prev, status: "completed", winner: payload.winner } : null);
        break;
      }

      case "spectator_count": {
        const payload = msg.payload as { count: number };
        setDebate((prev) => prev ? { ...prev, spectatorCount: payload.count } : null);
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
  }, []);

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
      ws.send(JSON.stringify({
        type: "join_debate",
        payload: { debateId, userId: publicKey || undefined },
      }));
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
      setConnectionStatus((prev) => prev === "connected" ? "disconnected" : prev);
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

    wsRef.current?.send(JSON.stringify({
      type: "submit_vote",
      payload: {
        debateId,
        round: debate.currentRound,
        choice: position,
      },
    }));
  };

  const totalVotes = currentVotes.pro + currentVotes.con;

  // Loading state
  if (connectionStatus === "connecting") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="text-center p-8">
          <div className="animate-spin w-8 h-8 border-2 border-arena-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to debate...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || connectionStatus === "disconnected") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="text-center p-8">
          <p className="text-arena-con mb-4">{error || "Disconnected from server"}</p>
          <Link to="/queue">
            <Button>Back to Queue</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/queue">
          <Button variant="ghost" size="sm">
            Back to Queue
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {/* TTS Toggle */}
          <Button
            variant={ttsEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="flex items-center gap-1"
          >
            {ttsEnabled ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                {isSpeaking ? "Speaking..." : "TTS On"}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                TTS Off
              </>
            )}
          </Button>
          {debate?.status === "in_progress" && <Badge variant="live">LIVE</Badge>}
          {debate?.status === "completed" && <Badge variant="outline">COMPLETED</Badge>}
          <span className="text-sm text-gray-400">
            {debate?.spectatorCount || 0} watching
          </span>
        </div>
      </div>

      {/* Topic */}
      <Card className="text-center py-4">
        <CardContent>
          {topic && (
            <Badge variant="outline" className="mb-2">
              {topic.category.toUpperCase()}
            </Badge>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {topic?.text || debate?.topic || "Loading..."}
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-400">
            <span>Round: {debate?.currentRound || "pending"}</span>
            <span>|</span>
            <span>Status: {debate?.roundStatus || "waiting"}</span>
            <span>|</span>
            <span>Stake: {(debate?.stake || 0).toLocaleString()} XNT</span>
          </div>
        </CardContent>
      </Card>

      {/* Vote Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-arena-pro font-medium">PRO {currentVotes.pro}</span>
          <span className="text-arena-con font-medium">CON {currentVotes.con}</span>
        </div>
        <DualProgress proValue={currentVotes.pro} conValue={currentVotes.con} />
      </div>

      {/* Main Arena */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* PRO Bot Panel */}
        <div className="hidden lg:block">
          <BotInfoPanel
            bot={proBot}
            position="pro"
            votes={currentVotes.pro}
            totalVotes={totalVotes}
          />
        </div>

        {/* Debate Feed */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>Debate Feed</CardTitle>
              <CardDescription>
                {messages.length === 0 ? "Waiting for debate to start..." : `${messages.length} messages`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  botName={
                    message.position === "pro"
                      ? proBot?.name || "Pro Bot"
                      : conBot?.name || "Con Bot"
                  }
                />
              ))}

              {/* Typing indicator */}
              {typingBot && (
                <div className={`flex ${typingBot === "pro" ? "justify-start" : "justify-end"}`}>
                  <div className="flex items-center gap-2 text-sm text-gray-400 p-4">
                    <span>{typingBot === "pro" ? proBot?.name : conBot?.name} is typing</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>
          </Card>
        </div>

        {/* CON Bot Panel */}
        <div className="hidden lg:block">
          <BotInfoPanel
            bot={conBot}
            position="con"
            votes={currentVotes.con}
            totalVotes={totalVotes}
          />
        </div>
      </div>

      {/* Voting Section */}
      {debate?.roundStatus === "voting" && (
        <Card className="border-arena-accent">
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">Cast Your Vote - {debate.currentRound.toUpperCase()}</h3>
                <p className="text-sm text-gray-400">
                  {hasVoted
                    ? "You voted for " + selectedVote?.toUpperCase()
                    : "Vote for the side you think won this round"}
                </p>
              </div>
              {connected ? (
                <div className="flex gap-4">
                  <Button
                    variant="pro"
                    disabled={hasVoted}
                    onClick={() => handleVote("pro")}
                    className={hasVoted && selectedVote !== "pro" ? "opacity-50" : ""}
                  >
                    Vote PRO
                  </Button>
                  <Button
                    variant="con"
                    disabled={hasVoted}
                    onClick={() => handleVote("con")}
                    className={hasVoted && selectedVote !== "con" ? "opacity-50" : ""}
                  >
                    Vote CON
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Connect wallet to vote
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Winner Banner */}
      {debate?.status === "completed" && debate.winner && (
        <Card className={debate.winner === "pro" ? "border-arena-pro bg-arena-pro/10" : "border-arena-con bg-arena-con/10"}>
          <CardContent className="text-center py-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              🎉 {debate.winner === "pro" ? proBot?.name : conBot?.name} Wins! 🎉
            </h2>
            <p className="text-gray-400">
              Final Score: PRO {debate.roundResults.filter(r => r.winner === "pro").length} - CON {debate.roundResults.filter(r => r.winner === "con").length}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Round Results */}
      {debate && debate.roundResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Round Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debate.roundResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-arena-border last:border-0"
                >
                  <span className="capitalize text-white font-medium">
                    {result.round}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-arena-pro">{result.proVotes}</span>
                    <span className="text-gray-400">-</span>
                    <span className="text-arena-con">{result.conVotes}</span>
                    <Badge variant={result.winner === "pro" ? "pro" : "con"}>
                      {result.winner.toUpperCase()} wins
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
