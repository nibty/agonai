import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Select } from "@/components/ui/Input";
import type { Bot } from "@/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// Load bots from localStorage (same as Bots page)
function loadBots(): Bot[] {
  const saved = localStorage.getItem("ai-debates-bots");
  if (saved) {
    const parsed = JSON.parse(saved) as Bot[];
    return parsed.map((b) => ({ ...b, createdAt: new Date(b.createdAt) }));
  }
  return [];
}

function BotSelectionCard({
  bot,
  selected,
  onSelect,
}: {
  bot: Bot;
  selected: boolean;
  onSelect: () => void;
}) {
  const winRate = bot.wins + bot.losses > 0
    ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1)
    : "0.0";

  return (
    <Card
      variant={selected ? "glow" : "default"}
      className={`cursor-pointer transition-all ${
        selected ? "ring-2 ring-arena-accent" : "hover:border-arena-accent/50"
      }`}
      onClick={onSelect}
    >
      <CardContent className="flex items-center gap-4">
        <BotAvatar size="lg" alt={bot.name} tier={bot.tier} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{bot.name}</h3>
            <TierBadge tier={bot.tier} />
          </div>
          <div className="text-sm text-gray-400 mt-1">
            ELO {bot.elo} | {winRate}% win rate
          </div>
          <div className="flex gap-1 mt-2">
            {bot.personalityTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-arena-pro">{bot.wins}W</div>
          <div className="text-arena-con">{bot.losses}L</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueStatusCard({
  inQueue,
  selectedBot,
  waitTime,
  queueStatus,
  onLeaveQueue,
}: {
  inQueue: boolean;
  selectedBot: Bot | null;
  waitTime: number;
  queueStatus: string;
  onLeaveQueue: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!inQueue) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [inQueue]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!inQueue) return null;

  return (
    <Card variant="glow" className="text-center">
      <CardContent className="py-8">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-arena-border"></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-arena-accent border-t-transparent animate-spin"
            style={{ animationDuration: "2s" }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {queueStatus}
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Searching for a bot with similar ELO ({selectedBot?.elo})
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
          <span>Est. wait:</span>
          <span className="text-white font-medium">{formatTime(waitTime)}</span>
        </div>
        <Button variant="outline" onClick={onLeaveQueue}>
          Leave Queue
        </Button>
      </CardContent>
    </Card>
  );
}

export function QueuePage() {
  const { connected, connect, publicKey } = useWallet();
  const navigate = useNavigate();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState("Finding Opponent...");
  const [stake, setStake] = useState(100);
  const [queueStats, setQueueStats] = useState({ queueSize: 0, avgWaitTime: 45 });
  const [error, setError] = useState<string | null>(null);

  const selectedBot = bots.find((b) => b.id === selectedBotId) || null;

  // Load bots from localStorage
  useEffect(() => {
    setBots(loadBots());
  }, []);

  // Fetch queue stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/queue/stats`);
        if (res.ok) {
          const data = await res.json();
          setQueueStats(data);
        }
      } catch {
        // Ignore - server might not be running
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll for match when in queue
  useEffect(() => {
    if (!inQueue || !selectedBot) return;

    const checkForMatch = async () => {
      try {
        const res = await fetch(`${API_BASE}/debates/active`);
        if (res.ok) {
          const data = await res.json();
          // Check if any active debate includes our bot
          const myDebate = data.debates?.find(
            (d: { proBot: { id: string }; conBot: { id: string } }) =>
              d.proBot.id === selectedBot.id || d.conBot.id === selectedBot.id
          );
          if (myDebate) {
            setInQueue(false);
            navigate(`/arena/${myDebate.id}`);
          }
        }
      } catch {
        // Ignore
      }
    };

    const interval = setInterval(checkForMatch, 2000);
    return () => clearInterval(interval);
  }, [inQueue, selectedBot, navigate]);

  const registerBotWithBackend = useCallback(async (bot: Bot) => {
    if (!publicKey) return null;

    try {
      const res = await fetch(`${API_BASE}/bots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${publicKey}`,
        },
        body: JSON.stringify({
          name: bot.name,
          endpoint: bot.endpoint,
          authToken: "dev-token",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.bot.id;
      }
      return null;
    } catch {
      return null;
    }
  }, [publicKey]);

  const handleJoinQueue = async () => {
    if (!selectedBot || !publicKey) return;
    setError(null);
    setQueueStatus("Registering bot...");
    setInQueue(true);

    try {
      // First register the bot with backend
      const backendBotId = await registerBotWithBackend(selectedBot);

      if (!backendBotId) {
        // Try to use local bot ID if registration fails
        console.warn("Bot registration failed, using local ID");
      }

      setQueueStatus("Joining queue...");

      // Join the queue
      const res = await fetch(`${API_BASE}/queue/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${publicKey}`,
        },
        body: JSON.stringify({
          botId: backendBotId || selectedBot.id,
          stake,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join queue");
      }

      setQueueStatus("Finding Opponent...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join queue");
      setInQueue(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!selectedBot || !publicKey) {
      setInQueue(false);
      return;
    }

    try {
      await fetch(`${API_BASE}/queue/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${publicKey}`,
        },
        body: JSON.stringify({
          botId: selectedBot.id,
        }),
      });
    } catch {
      // Ignore
    }

    setInQueue(false);
    setQueueStatus("Finding Opponent...");
  };

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <Card>
          <CardContent className="py-12">
            <div className="w-16 h-16 rounded-full bg-arena-accent/20 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-arena-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to join the matchmaking queue and compete with
              your bots.
            </p>
            <Button onClick={connect}>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Matchmaking Queue</h1>
        <p className="text-gray-400">
          Select a bot and join the queue to find an opponent
        </p>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-arena-con/20 border-arena-con">
          <CardContent className="py-4 text-center text-arena-con">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {queueStats.queueSize}
            </div>
            <div className="text-sm text-gray-400">In Queue</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {Math.floor(queueStats.avgWaitTime / 60)}:
              {(queueStats.avgWaitTime % 60).toString().padStart(2, "0")}
            </div>
            <div className="text-sm text-gray-400">Avg Wait</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {bots.length}
            </div>
            <div className="text-sm text-gray-400">Your Bots</div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status (when in queue) */}
      <QueueStatusCard
        inQueue={inQueue}
        selectedBot={selectedBot}
        waitTime={queueStats.avgWaitTime}
        queueStatus={queueStatus}
        onLeaveQueue={handleLeaveQueue}
      />

      {/* Bot Selection */}
      {!inQueue && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Select Your Bot
            </h2>
            {bots.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    You don't have any bots yet.
                  </p>
                  <Link to="/bots">
                    <Button>Register a Bot</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {bots.map((bot) => (
                  <BotSelectionCard
                    key={bot.id}
                    bot={bot}
                    selected={selectedBotId === bot.id}
                    onSelect={() => setSelectedBotId(bot.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Queue Settings */}
          {selectedBot && (
            <Card>
              <CardHeader>
                <CardTitle>Queue Settings</CardTitle>
                <CardDescription>
                  Configure your matchmaking preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Stake Amount (XNT)
                  </label>
                  <Select
                    value={stake.toString()}
                    onChange={(e) => setStake(parseInt(e.target.value))}
                  >
                    <option value="50">50 XNT</option>
                    <option value="100">100 XNT</option>
                    <option value="250">250 XNT</option>
                    <option value="500">500 XNT</option>
                    <option value="1000">1000 XNT</option>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Join Button */}
          <div className="text-center">
            <Button
              size="lg"
              disabled={!selectedBot}
              onClick={handleJoinQueue}
              className="min-w-[200px]"
            >
              {selectedBot ? "Join Queue" : "Select a Bot First"}
            </Button>
          </div>
        </>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-arena-accent font-bold">1.</span>
              Start the demo bots: <code className="bg-arena-bg px-2 py-0.5 rounded">cd bots && bun run dev</code>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent font-bold">2.</span>
              Start the backend: <code className="bg-arena-bg px-2 py-0.5 rounded">cd server && bun run dev</code>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent font-bold">3.</span>
              Open two browser windows, select different bots, and join queue in both
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
