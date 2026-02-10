import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { TierBadge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Input";
import { api, type Bot, type DebatePreset } from "@/lib/api";
import { getTierFromElo, type BotTier } from "@/types";

interface DisplayBot extends Bot {
  tier: BotTier;
}

function BotSelectionCard({
  bot,
  selected,
  onSelect,
}: {
  bot: DisplayBot;
  selected: boolean;
  onSelect: () => void;
}) {
  const winRate =
    bot.wins + bot.losses > 0 ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1) : "0.0";

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-white">{bot.name}</h3>
            <TierBadge tier={bot.tier} />
          </div>
          <div className="mt-1 text-sm text-gray-400">
            ELO {bot.elo} | {winRate}% win rate
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
  selectedBot: DisplayBot | null;
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
        <div className="relative mx-auto mb-4 h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-arena-border"></div>
          <div
            className="absolute inset-0 animate-spin rounded-full border-4 border-arena-accent border-t-transparent"
            style={{ animationDuration: "2s" }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{formatTime(elapsed)}</span>
          </div>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-white">{queueStatus}</h3>
        <p className="mb-4 text-sm text-gray-400">
          Searching for a bot with similar ELO ({selectedBot?.elo})
        </p>
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-gray-400">
          <span>Est. wait:</span>
          <span className="font-medium text-white">{formatTime(waitTime)}</span>
        </div>
        <Button variant="outline" onClick={onLeaveQueue}>
          Leave Queue
        </Button>
      </CardContent>
    </Card>
  );
}

export function QueuePage() {
  const { connected, connect } = useWallet();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState("Finding Opponent...");
  const [stake, setStake] = useState(100);
  const [selectedPresetId, setSelectedPresetId] = useState("classic");
  const [error, setError] = useState<string | null>(null);

  // Fetch user's bots from API
  const { data: botsData, isLoading: botsLoading } = useQuery({
    queryKey: ["bots", "my"],
    queryFn: () => api.getMyBots(),
    enabled: isAuthenticated,
  });

  // Transform bots to include tier
  const bots: DisplayBot[] = (botsData?.bots ?? []).map((bot) => ({
    ...bot,
    tier: getTierFromElo(bot.elo),
  }));

  const selectedBot = bots.find((b) => b.id === selectedBotId) || null;

  // Fetch queue stats
  const { data: queueStats } = useQuery({
    queryKey: ["queue", "stats"],
    queryFn: () => api.getQueueStats(),
    refetchInterval: 5000,
  });

  // Fetch debate presets
  const { data: presetsData } = useQuery({
    queryKey: ["presets"],
    queryFn: () => api.getPresets(),
  });

  const presets: DebatePreset[] = presetsData?.presets ?? [];
  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  // Join queue mutation
  const joinQueueMutation = useMutation({
    mutationFn: (data: { botId: string; stake: number; presetId: string }) => api.joinQueue(data),
    onSuccess: () => {
      setQueueStatus("Finding Opponent...");
    },
    onError: (err: Error) => {
      setError(err.message);
      setInQueue(false);
    },
  });

  // Leave queue mutation
  const leaveQueueMutation = useMutation({
    mutationFn: (botId: string) => api.leaveQueue(botId),
    onSuccess: () => {
      setInQueue(false);
      setQueueStatus("Finding Opponent...");
      queryClient.invalidateQueries({ queryKey: ["queue", "stats"] });
    },
  });

  // Poll for match when in queue
  useEffect(() => {
    if (!inQueue || !selectedBotId) return;

    const checkForMatch = async () => {
      try {
        const { debates } = await api.getActiveDebates();
        const myDebate = debates?.find(
          (d) => d.proBotId === selectedBotId || d.conBotId === selectedBotId
        );
        if (myDebate) {
          setInQueue(false);
          navigate(`/arena/${myDebate.id}`);
        }
      } catch {
        // Ignore
      }
    };

    const interval = setInterval(() => void checkForMatch(), 2000);
    return () => clearInterval(interval);
  }, [inQueue, selectedBotId, navigate]);

  const handleJoinQueue = () => {
    if (!selectedBot) return;
    setError(null);
    setInQueue(true);
    setQueueStatus("Joining queue...");
    joinQueueMutation.mutate({ botId: selectedBot.id, stake, presetId: selectedPresetId });
  };

  const handleLeaveQueue = () => {
    if (selectedBotId) {
      leaveQueueMutation.mutate(selectedBotId);
    } else {
      setInQueue(false);
    }
  };

  if (!connected) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Card>
          <CardContent className="py-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-arena-accent/20">
              <svg
                className="h-8 w-8 text-arena-accent"
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
            <h2 className="mb-2 text-xl font-bold text-white">Connect Your Wallet</h2>
            <p className="mb-6 text-gray-400">
              Connect your wallet to join the matchmaking queue and compete with your bots.
            </p>
            <Button onClick={connect}>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-white">Matchmaking Queue</h1>
        <p className="text-gray-400">Select a bot and join the queue to find an opponent</p>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-arena-con bg-arena-con/20">
          <CardContent className="py-4 text-center text-arena-con">{error}</CardContent>
        </Card>
      )}

      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">{queueStats?.queueSize ?? 0}</div>
            <div className="text-sm text-gray-400">In Queue</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {Math.floor((queueStats?.avgWaitTime ?? 45) / 60)}:
              {((queueStats?.avgWaitTime ?? 45) % 60).toString().padStart(2, "0")}
            </div>
            <div className="text-sm text-gray-400">Avg Wait</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">{bots.length}</div>
            <div className="text-sm text-gray-400">Your Bots</div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status (when in queue) */}
      <QueueStatusCard
        inQueue={inQueue}
        selectedBot={selectedBot}
        waitTime={queueStats?.avgWaitTime ?? 45}
        queueStatus={queueStatus}
        onLeaveQueue={handleLeaveQueue}
      />

      {/* Bot Selection */}
      {!inQueue && (
        <>
          <div>
            <h2 className="mb-4 text-xl font-semibold text-white">Select Your Bot</h2>
            {botsLoading ? (
              <Card className="py-8 text-center">
                <CardContent>
                  <p className="text-gray-400">Loading your bots...</p>
                </CardContent>
              </Card>
            ) : bots.length === 0 ? (
              <Card className="py-8 text-center">
                <CardContent>
                  <p className="mb-4 text-gray-400">You don't have any bots yet.</p>
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
                <CardDescription>Configure your matchmaking preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">Debate Format</label>
                  <Select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </Select>
                  {selectedPreset && (
                    <p className="mt-2 text-xs text-gray-500">{selectedPreset.description}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-400">Stake Amount (XNT)</label>
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
              disabled={!selectedBot || joinQueueMutation.isPending}
              onClick={handleJoinQueue}
              className="min-w-[200px]"
            >
              {joinQueueMutation.isPending
                ? "Joining..."
                : selectedBot
                  ? "Join Queue"
                  : "Select a Bot First"}
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
          <ol className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="font-bold text-arena-accent">1.</span>
              Start the demo bots:{" "}
              <code className="rounded bg-arena-bg px-2 py-0.5">bun run dev:bot</code>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-arena-accent">2.</span>
              Register a bot on the{" "}
              <Link to="/bots" className="text-arena-accent hover:underline">
                Bots page
              </Link>{" "}
              with an endpoint like http://localhost:4000/bot/logical/debate
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-arena-accent">3.</span>
              Open two browser windows, select different bots, and join queue in both
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
