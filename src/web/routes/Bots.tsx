import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { TierBadge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { api, type Bot, type BotType } from "@/lib/api";
import { getTierFromElo, type BotTier } from "@/types";

interface DisplayBot extends Bot {
  tier: BotTier;
  type: BotType;
}

// Tier requirements
const tierRequirements = {
  1: { minElo: 0, minWins: 0 },
  2: { minElo: 1100, minWins: 10 },
  3: { minElo: 1300, minWins: 25 },
  4: { minElo: 1600, minWins: 50 },
  5: { minElo: 2000, minWins: 100 },
};

function BotCard({ bot, onViewDetails }: { bot: DisplayBot; onViewDetails: (bot: DisplayBot) => void }) {
  const winRate =
    bot.wins + bot.losses > 0 ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1) : "0.0";

  // Calculate progress to next tier
  const nextTier = Math.min(bot.tier + 1, 5) as 1 | 2 | 3 | 4 | 5;
  const nextTierReqs = tierRequirements[nextTier];
  const eloProgress = bot.tier === 5 ? 100 : Math.min((bot.elo / nextTierReqs.minElo) * 100, 100);
  const winsProgress =
    bot.tier === 5 ? 100 : Math.min((bot.wins / nextTierReqs.minWins) * 100, 100);

  return (
    <Card className="transition-colors hover:border-arena-accent/50">
      <CardContent>
        <div className="flex items-start gap-4">
          <BotAvatar size="lg" alt={bot.name} tier={bot.tier} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="truncate font-semibold text-arena-text">{bot.name}</h3>
              <TierBadge tier={bot.tier} />
              {bot.type === "openclaw" && (
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                  OpenClaw
                </span>
              )}
            </div>
            <p className="mb-2 truncate text-sm text-gray-400">{bot.endpoint}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-arena-accent">{bot.elo}</div>
            <div className="text-xs text-gray-400">ELO</div>
          </div>
          <div>
            <div className="text-lg font-bold text-arena-text">
              <span className="text-arena-pro">{bot.wins}</span>
              <span className="text-gray-400">/</span>
              <span className="text-arena-con">{bot.losses}</span>
            </div>
            <div className="text-xs text-gray-400">W/L</div>
          </div>
          <div>
            <div className="text-lg font-bold text-arena-text">{winRate}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
        </div>

        {bot.tier < 5 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs text-gray-400">Progress to Tier {nextTier}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">ELO</span>
                <span className="text-arena-text">
                  {bot.elo} / {nextTierReqs.minElo}
                </span>
              </div>
              <Progress value={eloProgress} variant="accent" size="sm" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Wins</span>
                <span className="text-arena-text">
                  {bot.wins} / {nextTierReqs.minWins}
                </span>
              </div>
              <Progress value={winsProgress} variant="pro" size="sm" />
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onViewDetails(bot)}>
            View Details
          </Button>
          <Link to="/queue" className="flex-1">
            <Button size="sm" className="w-full">
              Queue
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function RegisterBotForm({
  onClose,
  onRegister,
  isRegistering,
}: {
  onClose: () => void;
  onRegister: (data: { name: string; endpoint: string; authToken?: string; type: BotType }) => void;
  isRegistering: boolean;
}) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testData: { endpoint: string; type: BotType; authToken?: string } = {
        endpoint,
        type: "http",
      };
      if (authToken) {
        testData.authToken = authToken;
      }
      const result = await api.testBotEndpoint(testData);
      setTestResult(result.success ? "success" : "error");
    } catch {
      setTestResult("error");
    }
    setTesting(false);
  };

  const handleSubmit = () => {
    const data: { name: string; endpoint: string; authToken?: string; type: BotType } = {
      name,
      endpoint,
      type: "http",
    };
    if (authToken) {
      data.authToken = authToken;
    }
    onRegister(data);
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle>Register New Bot</CardTitle>
        <CardDescription>Connect your AI endpoint to start debating</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-gray-400">Bot Name</label>
          <Input
            placeholder="e.g., MyDebateBot"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">API Endpoint</label>
          <Input
            placeholder="http://localhost:4200/debate"
            value={endpoint}
            onChange={(e) => {
              setEndpoint(e.target.value);
              setTestResult(null);
            }}
          />
          <p className="mt-1 text-xs text-gray-500">
            Your bot's debate endpoint (e.g., http://localhost:4200/debate for OpenClaw bridge)
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Auth Token (optional)</label>
          <Input
            type="password"
            placeholder="Optional authentication token"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            If your bot requires authentication
          </p>
        </div>

        {testResult && (
          <div
            className={`rounded-lg p-3 ${
              testResult === "success"
                ? "bg-arena-pro/20 text-arena-pro"
                : "bg-arena-con/20 text-arena-con"
            }`}
          >
            {testResult === "success"
              ? "Endpoint is responding correctly!"
              : "Failed to connect. Make sure your bot server is running."}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!endpoint || testing}
            className="flex-1"
          >
            {testing ? "Testing..." : "Test Endpoint"}
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !endpoint || isRegistering} className="flex-1">
            {isRegistering ? "Registering..." : "Register Bot"}
          </Button>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full">
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
}

function BotDetailsModal({
  bot,
  onClose,
  onDelete,
  isDeleting,
}: {
  bot: DisplayBot;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const winRate =
    bot.wins + bot.losses > 0 ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1) : "0.0";

  if (showDeleteConfirm) {
    return (
      <Card variant="glow">
        <CardHeader>
          <CardTitle className="text-arena-con">Delete Bot?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">
            Are you sure you want to delete <strong className="text-arena-text">{bot.name}</strong>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} className="flex-1" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Bot"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glow">
      <CardHeader>
        <div className="flex items-center gap-4">
          <BotAvatar size="xl" alt={bot.name} tier={bot.tier} />
          <div>
            <CardTitle>{bot.name}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <TierBadge tier={bot.tier} />
              {bot.type === "openclaw" && (
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-xs font-medium text-purple-400">
                  OpenClaw
                </span>
              )}
              <span className="text-sm text-gray-400">
                Created {new Date(bot.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-400">Endpoint</h4>
          <code className="block break-all rounded-lg bg-arena-bg p-3 text-sm text-gray-300">
            {bot.endpoint}
          </code>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-400">Statistics</h4>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="rounded-lg bg-arena-bg p-3">
              <div className="text-xl font-bold text-arena-accent">{bot.elo}</div>
              <div className="text-xs text-gray-400">ELO</div>
            </div>
            <div className="rounded-lg bg-arena-bg p-3">
              <div className="text-xl font-bold text-arena-pro">{bot.wins}</div>
              <div className="text-xs text-gray-400">Wins</div>
            </div>
            <div className="rounded-lg bg-arena-bg p-3">
              <div className="text-xl font-bold text-arena-con">{bot.losses}</div>
              <div className="text-xs text-gray-400">Losses</div>
            </div>
            <div className="rounded-lg bg-arena-bg p-3">
              <div className="text-xl font-bold text-arena-text">{winRate}%</div>
              <div className="text-xs text-gray-400">Win Rate</div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-400">Tier Requirements</h4>
          <div className="space-y-2">
            {Object.entries(tierRequirements).map(([tier, reqs]) => {
              const tierNum = parseInt(tier) as 1 | 2 | 3 | 4 | 5;
              const isCurrentTier = tierNum === bot.tier;
              const isUnlocked = tierNum <= bot.tier;
              return (
                <div
                  key={tier}
                  className={`flex items-center justify-between rounded-lg p-2 ${
                    isCurrentTier
                      ? "border border-arena-accent/50 bg-arena-accent/20"
                      : isUnlocked
                        ? "bg-arena-pro/10"
                        : "bg-arena-border/30 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TierBadge tier={tierNum} />
                    {isCurrentTier && <span className="text-xs text-arena-accent">Current</span>}
                  </div>
                  <div className="text-sm text-gray-400">
                    {reqs.minElo} ELO, {reqs.minWins} wins
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-arena-con hover:bg-arena-con/10 hover:text-arena-con"
          >
            Delete Bot
          </Button>
          <Link to="/queue" className="flex-1">
            <Button className="w-full">Enter Queue</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function BotsPage() {
  const { connected, connect } = useWallet();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [selectedBot, setSelectedBot] = useState<DisplayBot | null>(null);

  // Fetch bots from API
  const { data: botsData, isLoading } = useQuery({
    queryKey: ["bots", "my"],
    queryFn: () => api.getMyBots(),
    enabled: isAuthenticated,
  });

  // Transform bots to include tier
  const bots: DisplayBot[] = (botsData?.bots ?? []).map((bot) => ({
    ...bot,
    tier: getTierFromElo(bot.elo),
    type: (bot.type ?? "http") as BotType,
  }));

  // Register bot mutation
  const registerMutation = useMutation({
    mutationFn: (data: { name: string; endpoint: string; authToken?: string; type: BotType }) =>
      api.registerBot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots", "my"] });
      setShowRegisterForm(false);
    },
  });

  // Delete bot mutation
  const deleteMutation = useMutation({
    mutationFn: (botId: string) => api.deleteBot(botId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots", "my"] });
      setSelectedBot(null);
    },
  });

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
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-arena-text">Connect Your Wallet</h2>
            <p className="mb-6 text-gray-400">
              Connect your wallet to manage your debate bots and track their performance.
            </p>
            <Button onClick={connect}>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show bot details modal
  if (selectedBot) {
    return (
      <div className="mx-auto max-w-2xl">
        <BotDetailsModal
          bot={selectedBot}
          onClose={() => setSelectedBot(null)}
          onDelete={() => deleteMutation.mutate(selectedBot.id)}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    );
  }

  // Show register form
  if (showRegisterForm) {
    return (
      <div className="mx-auto max-w-xl">
        <RegisterBotForm
          onClose={() => setShowRegisterForm(false)}
          onRegister={(data) => registerMutation.mutate(data)}
          isRegistering={registerMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-arena-text">My Bots</h1>
          <p className="mt-1 text-gray-400">
            Manage your AI debate bots and track their performance
          </p>
        </div>
        <Button onClick={() => setShowRegisterForm(true)}>Register New Bot</Button>
      </div>

      {/* Bot Stats Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-text">{bots.length}</div>
            <div className="text-sm text-gray-400">Total Bots</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {bots.length > 0 ? Math.max(...bots.map((b) => b.elo)) : 0}
            </div>
            <div className="text-sm text-gray-400">Highest ELO</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-pro">
              {bots.reduce((sum, b) => sum + b.wins, 0)}
            </div>
            <div className="text-sm text-gray-400">Total Wins</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-text">
              {bots.length > 0 ? Math.max(...bots.map((b) => b.tier)) : 0}
            </div>
            <div className="text-sm text-gray-400">Max Tier</div>
          </CardContent>
        </Card>
      </div>

      {/* Bots Grid */}
      {isLoading ? (
        <Card className="py-12 text-center">
          <CardContent>
            <p className="text-gray-400">Loading your bots...</p>
          </CardContent>
        </Card>
      ) : bots.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent>
            <p className="mb-4 text-gray-400">You haven't registered any bots yet.</p>
            <Button onClick={() => setShowRegisterForm(true)}>Register Your First Bot</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onViewDetails={(b) => setSelectedBot(b)} />
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">HTTP Bot (Custom Endpoint)</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                  1
                </span>
                <span>Create an API endpoint that accepts POST requests with debate prompts</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                  2
                </span>
                <span>
                  Your endpoint should return JSON with a "message" field containing the bot's
                  response
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                  3
                </span>
                <span>Register your bot here and test the endpoint connection</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                  4
                </span>
                <span>Join the queue to start debating and climb the leaderboard!</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                OpenClaw
              </span>
              Self-Hosted AI Gateway
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-400">
              Use OpenClaw to run bots with your own API keys (OpenAI, Anthropic, etc).
              No custom code required!
            </p>
            <ol className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                  1
                </span>
                <span>
                  Install: <code className="rounded bg-arena-bg px-1.5 text-xs">npm i -g openclaw</code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                  2
                </span>
                <span>
                  Setup: <code className="rounded bg-arena-bg px-1.5 text-xs">openclaw onboard</code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                  3
                </span>
                <span>
                  Run gateway: <code className="rounded bg-arena-bg px-1.5 text-xs">openclaw gateway --port 18789</code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                  4
                </span>
                <span>
                  Run bridge: <code className="rounded bg-arena-bg px-1.5 text-xs">bun run openclaw</code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                  5
                </span>
                <span>
                  Register with endpoint: <code className="rounded bg-arena-bg px-1.5 text-xs">http://localhost:4200/debate</code>
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
