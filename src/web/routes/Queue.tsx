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

interface QueuedBotInfo {
  bot: DisplayBot;
  presetId: string;
  joinedAt: Date;
}

export function QueuePage() {
  const { connected, connect } = useWallet();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [queuedBots, setQueuedBots] = useState<Map<string, QueuedBotInfo>>(new Map());
  const [selectedPresetId, setSelectedPresetId] = useState("classic");
  const [allowSameOwnerMatch, setAllowSameOwnerMatch] = useState(false);
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

  const selectedBot = bots.find((b) => b.id == selectedBotId) || null;

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
    mutationFn: (data: {
      botId: string;
      stake: number;
      presetId: string;
      allowSameOwnerMatch?: boolean;
    }) => api.joinQueue(data),
    onSuccess: (_data, variables) => {
      const bot = bots.find((b) => b.id == variables.botId);
      if (bot) {
        setQueuedBots((prev) => {
          const next = new Map(prev);
          next.set(variables.botId, {
            bot,
            presetId: variables.presetId,
            joinedAt: new Date(),
          });
          return next;
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["queue", "stats"] });
    },
    onError: (err: Error, variables) => {
      setError(err.message);
      setQueuedBots((prev) => {
        const next = new Map(prev);
        next.delete(variables.botId);
        return next;
      });
    },
  });

  // Leave queue mutation
  const leaveQueueMutation = useMutation({
    mutationFn: (botId: string) => api.leaveQueue(botId),
    onSuccess: (_data, botId) => {
      setQueuedBots((prev) => {
        const next = new Map(prev);
        next.delete(botId);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["queue", "stats"] });
    },
  });

  // Poll for match when bots are in queue
  useEffect(() => {
    if (queuedBots.size === 0) return;

    const checkForMatch = async () => {
      try {
        const { debates } = await api.getActiveDebates();
        const queuedBotIds = Array.from(queuedBots.keys());
        const myDebate = debates?.find(
          (d) => queuedBotIds.includes(d.proBotId) || queuedBotIds.includes(d.conBotId)
        );
        if (myDebate) {
          // Remove the matched bot from queue
          const matchedBotId =
            queuedBotIds.find((id) => id === myDebate.proBotId || id === myDebate.conBotId) || "";
          setQueuedBots((prev) => {
            const next = new Map(prev);
            next.delete(matchedBotId);
            return next;
          });
          void navigate(`/arena/${myDebate.id}`);
        }
      } catch {
        // Ignore
      }
    };

    const interval = setInterval(() => void checkForMatch(), 2000);
    return () => clearInterval(interval);
  }, [queuedBots, navigate]);

  const handleJoinQueue = () => {
    if (!selectedBot) return;
    if (queuedBots.has(selectedBot.id)) {
      setError("This bot is already in the queue");
      return;
    }
    setError(null);
    joinQueueMutation.mutate({
      botId: selectedBot.id,
      stake: 0,
      presetId: selectedPresetId,
      allowSameOwnerMatch,
    });
  };

  const handleLeaveQueue = (botId: string) => {
    leaveQueueMutation.mutate(botId);
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
            <h2 className="mb-2 text-xl font-bold text-arena-text">Connect Your Wallet</h2>
            <p className="mb-6 text-gray-400">
              Connect your wallet to join the matchmaking queue and compete with your bots.
            </p>
            <div className="flex justify-center">
              <Button onClick={connect}>Connect Wallet</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-arena-text">Matchmaking Queue</h1>
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
            <div className="text-2xl font-bold text-arena-text">{queueStats?.queueSize ?? 0}</div>
            <div className="text-sm text-gray-400">In Queue</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-text">
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

      {/* Your Bots in Queue */}
      {queuedBots.size > 0 && (
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arena-accent opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-arena-accent"></span>
              </span>
              Your Bots in Queue ({queuedBots.size})
            </CardTitle>
            <CardDescription>Waiting for opponents...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(queuedBots.entries()).map(([botId, info]) => {
              const preset = presets.find((p) => p.id === info.presetId);
              const elapsed = Math.floor((Date.now() - info.joinedAt.getTime()) / 1000);
              const mins = Math.floor(elapsed / 60);
              const secs = elapsed % 60;
              return (
                <div
                  key={botId}
                  className="flex items-center gap-4 rounded-lg bg-arena-card/50 p-4"
                >
                  <BotAvatar size="md" alt={info.bot.name} tier={info.bot.tier} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-arena-text">{info.bot.name}</span>
                      <TierBadge tier={info.bot.tier} />
                    </div>
                    <div className="mt-1 text-sm text-gray-400">
                      {preset?.name ?? info.presetId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-arena-text">
                      {mins}:{secs.toString().padStart(2, "0")}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLeaveQueue(botId)}
                      disabled={leaveQueueMutation.isPending}
                    >
                      Leave
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Queue Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Settings</CardTitle>
          <CardDescription>Select a bot and configure matchmaking preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bot Selection Dropdown */}
          <div>
            <label className="mb-2 block text-sm text-gray-400">Select Bot</label>
            {botsLoading ? (
              <div className="text-sm text-gray-400">Loading bots...</div>
            ) : bots.length === 0 ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">No bots registered yet.</span>
                <Link to="/bots">
                  <Button size="sm">Register a Bot</Button>
                </Link>
              </div>
            ) : (
              <Select
                value={selectedBotId ?? ""}
                onChange={(e) => setSelectedBotId(e.target.value || null)}
              >
                <option value="">-- Select a bot --</option>
                {bots.map((bot) => {
                  const winRate =
                    bot.wins + bot.losses > 0
                      ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(0)
                      : "0";
                  const inQueue = queuedBots.has(bot.id);
                  return (
                    <option key={bot.id} value={bot.id} disabled={inQueue}>
                      {bot.name} - ELO {bot.elo} ({winRate}% WR){inQueue ? " [In Queue]" : ""}
                    </option>
                  );
                })}
              </Select>
            )}
            {selectedBot && (
              <div className="mt-2 flex items-center gap-3 rounded-lg bg-arena-card/50 p-3">
                <BotAvatar size="md" alt={selectedBot.name} tier={selectedBot.tier} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-arena-text">{selectedBot.name}</span>
                    <TierBadge tier={selectedBot.tier} />
                  </div>
                  <div className="text-sm text-gray-400">
                    {selectedBot.wins}W - {selectedBot.losses}L | ELO {selectedBot.elo}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Debate Format */}
          <div>
            <label className="mb-2 block text-sm text-gray-400">Debate Format</label>
            <Select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
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

          {/* Same-owner matching */}
          <div className="rounded-lg bg-arena-card/50 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={allowSameOwnerMatch}
                onChange={(e) => setAllowSameOwnerMatch(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-arena-bg text-arena-accent"
              />
              <div>
                <div className="text-sm font-medium text-arena-text">Allow same-owner matches</div>
                <div className="text-xs text-gray-400">
                  Off by default to prevent self-play. Enable only if you explicitly want your own
                  bots to match each other.
                </div>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Join Button */}
      <div className="text-center">
        <Button
          size="lg"
          disabled={
            !selectedBot || queuedBots.has(selectedBot?.id ?? "") || joinQueueMutation.isPending
          }
          onClick={handleJoinQueue}
          className="min-w-[200px]"
        >
          {joinQueueMutation.isPending ? "Joining..." : "Join Queue"}
        </Button>
      </div>
    </div>
  );
}
