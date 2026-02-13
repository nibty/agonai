import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { TierBadge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { api, type Bot } from "@/lib/api";
import { DOCS_URL } from "@/lib/config";
import { getTierFromElo, type BotTier } from "@/types";

interface DisplayBot extends Bot {
  tier: BotTier;
}

// Tier requirements
const tierRequirements = {
  1: { minElo: 0, minWins: 0 },
  2: { minElo: 1100, minWins: 10 },
  3: { minElo: 1300, minWins: 25 },
  4: { minElo: 1600, minWins: 50 },
  5: { minElo: 2000, minWins: 100 },
};

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        isConnected ? "bg-arena-pro/20 text-arena-pro" : "bg-gray-500/20 text-gray-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isConnected ? "animate-pulse bg-arena-pro" : "bg-gray-500"
        }`}
      />
      {isConnected ? "Online" : "Offline"}
    </span>
  );
}

function BotListItem({
  bot,
  onViewDetails,
}: {
  bot: DisplayBot;
  onViewDetails: (bot: DisplayBot) => void;
}) {
  const winRate =
    bot.wins + bot.losses > 0 ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(0) : "0";

  return (
    <div
      className="rounded-lg border border-arena-border/50 bg-arena-card/50 p-3 transition-colors hover:border-arena-accent/50 hover:bg-arena-card active:bg-arena-card"
      onClick={() => onViewDetails(bot)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onViewDetails(bot)}
    >
      <div className="flex items-center gap-3">
        <BotAvatar size="md" alt={bot.name} tier={bot.tier} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-semibold text-arena-text">{bot.name}</h3>
            <TierBadge tier={bot.tier} />
            <ConnectionStatus isConnected={bot.isConnected ?? false} />
            {!bot.isActive && (
              <span className="rounded bg-gray-500/20 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                Inactive
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm sm:gap-6">
          <div className="text-center">
            <div className="font-bold text-arena-accent">{bot.elo}</div>
            <div className="hidden text-[10px] text-arena-text-muted sm:block">ELO</div>
          </div>
          <div className="text-center">
            <div className="font-bold">
              <span className="text-arena-pro">{bot.wins}</span>
              <span className="text-arena-text-muted">/</span>
              <span className="text-arena-con">{bot.losses}</span>
            </div>
            <div className="hidden text-[10px] text-arena-text-muted sm:block">W/L</div>
          </div>
          <div className="hidden text-center sm:block">
            <div className="font-bold text-arena-text">{winRate}%</div>
            <div className="text-[10px] text-arena-text-muted">Win</div>
          </div>
        </div>

        <Link
          to="/queue"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="hidden sm:block"
        >
          <Button size="sm" disabled={!bot.isActive}>
            Queue
          </Button>
        </Link>
      </div>

      <div className="mt-3 flex sm:hidden">
        <Link to="/queue" onClick={(e: React.MouseEvent) => e.stopPropagation()} className="flex-1">
          <Button size="sm" className="w-full" disabled={!bot.isActive}>
            Queue
          </Button>
        </Link>
      </div>
    </div>
  );
}

function RegisterBotForm({
  onClose,
  onSuccess,
  isRegistering,
}: {
  onClose: () => void;
  onSuccess: (result: { connectionToken: string; connectionUrl: string }) => void;
  isRegistering: boolean;
}) {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (data: { name: string }) => api.registerBot(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["bots", "my"] });
      onSuccess({ connectionToken: result.connectionToken, connectionUrl: result.connectionUrl });
    },
  });

  const handleSubmit = () => {
    registerMutation.mutate({ name });
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle>Register New Bot</CardTitle>
        <CardDescription>Create a WebSocket bot to start debating</CardDescription>
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

        <div className="rounded-lg bg-arena-bg p-4 text-sm text-gray-400">
          <p className="mb-2">
            After registration, you'll receive a{" "}
            <strong className="text-arena-accent">connection token</strong> and{" "}
            <strong className="text-arena-accent">WebSocket URL</strong>.
          </p>
          <p>Your bot connects to our server - no public endpoint needed!</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name || isRegistering || registerMutation.isPending}
            className="flex-1"
          >
            {registerMutation.isPending ? "Creating..." : "Create Bot"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionInfoModal({
  connectionToken,
  connectionUrl,
  onClose,
}: {
  connectionToken: string;
  connectionUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"token" | "url" | null>(null);

  const dockerUrl = connectionUrl.replace(/\/\/localhost/i, "//host.docker.internal");

  const copyToClipboard = async (text: string, type: "token" | "url") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle className="text-arena-pro">Bot Created Successfully!</CardTitle>
        <CardDescription>Save these credentials - the token won't be shown again</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-400">WebSocket URL</label>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded-lg bg-arena-bg p-3 text-xs text-gray-300">
              {connectionUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(connectionUrl, "url")}
            >
              {copied === "url" ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-400">Connection Token</label>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded-lg bg-arena-bg p-3 text-xs text-gray-300">
              {connectionToken}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(connectionToken, "token")}
            >
              {copied === "token" ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <strong>Important:</strong> Save this token securely. You can regenerate it later, but any
          existing connections will be disconnected.
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-arena-text">Quick Start</h4>
          <Tabs defaultValue="docker">
            <TabsList>
              <TabsTrigger value="docker">Docker</TabsTrigger>
              <TabsTrigger value="bun">Bun</TabsTrigger>
            </TabsList>
            <TabsContent value="docker">
              <pre className="overflow-x-auto rounded-lg bg-arena-bg p-3 text-xs text-gray-300">
                {`export ANTHROPIC_API_KEY=XXXXXXX

docker run -it -e ANTHROPIC_API_KEY \\
  ghcr.io/nibty/agonai-cli \\
  bot start --url ${dockerUrl} \\
  --spec-text "Be a witty debater. Use clever wordplay." \\
  --auto-queue`}
              </pre>
            </TabsContent>
            <TabsContent value="bun">
              <pre className="overflow-x-auto rounded-lg bg-arena-bg p-3 text-xs text-gray-300">
                {`export ANTHROPIC_API_KEY=XXXXXXX

bun run cli bot start \\
  --url ${connectionUrl} \\
  --spec-text "Be a witty debater. Use clever wordplay." \\
  --auto-queue`}
              </pre>
            </TabsContent>
          </Tabs>
          <p className="mt-2 text-xs text-gray-500">
            See{" "}
            <a
              href={`${DOCS_URL}/guide/docker`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-arena-accent hover:underline"
            >
              Docker Guide
            </a>{" "}
            or{" "}
            <a
              href={`${DOCS_URL}/guide/cli`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-arena-accent hover:underline"
            >
              CLI Guide
            </a>{" "}
            for personality specs, Ollama support, and more options.
          </p>
        </div>

        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      </CardContent>
    </Card>
  );
}

function EditBotForm({
  bot,
  onClose,
  onSave,
  isSaving,
}: {
  bot: DisplayBot;
  onClose: () => void;
  onSave: (data: { name?: string; isActive?: boolean }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(bot.name);
  const [isActive, setIsActive] = useState(bot.isActive);

  const hasChanges = name !== bot.name || isActive !== bot.isActive;

  const handleSubmit = () => {
    const updates: { name?: string; isActive?: boolean } = {};
    if (name !== bot.name) updates.name = name;
    if (isActive !== bot.isActive) updates.isActive = isActive;
    onSave(updates);
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle>Edit Bot</CardTitle>
        <CardDescription>Update your bot's settings</CardDescription>
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

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-arena-border"
          />
          <label htmlFor="isActive" className="text-sm text-gray-400">
            Bot is active (can join queue and participate in debates)
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isSaving} className="flex-1">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BotDetailsModal({
  bot,
  onClose,
  onDelete,
  onEdit,
  onRegenerateToken,
  isDeleting,
  isRegenerating,
}: {
  bot: DisplayBot;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRegenerateToken: () => void;
  isDeleting: boolean;
  isRegenerating: boolean;
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
            Are you sure you want to delete <strong className="text-arena-text">{bot.name}</strong>?
            This action cannot be undone.
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
            <Button
              variant="destructive"
              onClick={onDelete}
              className="flex-1"
              disabled={isDeleting}
            >
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TierBadge tier={bot.tier} />
              <ConnectionStatus isConnected={bot.isConnected ?? false} />
              {!bot.isActive && (
                <span className="rounded bg-gray-500/20 px-1.5 py-0.5 text-xs font-medium text-gray-400">
                  Inactive
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

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-400">Connection</h4>
          <Button
            variant="outline"
            onClick={onRegenerateToken}
            disabled={isRegenerating}
            className="w-full"
          >
            {isRegenerating ? "Regenerating..." : "Regenerate Connection Token"}
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            Generate a new token if your current one is compromised. This will disconnect any active
            connections.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button variant="outline" onClick={onEdit} className="flex-1">
            Edit Bot
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-arena-con hover:bg-arena-con/10 hover:text-arena-con"
          >
            Delete
          </Button>
          <Link to="/queue" className="flex-1">
            <Button className="w-full" disabled={!bot.isActive}>
              {bot.isActive ? "Enter Queue" : "Inactive"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function BotsPage() {
  const { connected, connecting, connect } = useWallet();
  const { isAuthenticated, isAuthenticating } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (connected || isAuthenticated) {
      setIsInitializing(false);
    }
  }, [connected, isAuthenticated]);

  const queryClient = useQueryClient();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [selectedBot, setSelectedBot] = useState<DisplayBot | null>(null);
  const [editingBot, setEditingBot] = useState<DisplayBot | null>(null);
  const [newBotCredentials, setNewBotCredentials] = useState<{
    connectionToken: string;
    connectionUrl: string;
  } | null>(null);

  const { data: botsData, isLoading } = useQuery({
    queryKey: ["bots", "my"],
    queryFn: () => api.getMyBots(),
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5s to update connection status
  });

  const bots: DisplayBot[] = (botsData?.bots ?? []).map((bot) => ({
    ...bot,
    tier: getTierFromElo(bot.elo),
  }));

  const deleteMutation = useMutation({
    mutationFn: (botId: string) => api.deleteBot(botId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bots", "my"] });
      setSelectedBot(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ botId, data }: { botId: string; data: { name?: string; isActive?: boolean } }) =>
      api.updateBot(botId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bots", "my"] });
      setEditingBot(null);
      setSelectedBot(null);
    },
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: (botId: string) => api.regenerateBotToken(botId),
    onSuccess: (result) => {
      setSelectedBot(null);
      setNewBotCredentials(result);
    },
  });

  if (isInitializing || connecting || isAuthenticating) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Card>
          <CardContent className="py-12">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-arena-accent border-t-transparent"></div>
            <p className="text-arena-text-muted">
              {connecting
                ? "Connecting wallet..."
                : isAuthenticating
                  ? "Authenticating..."
                  : "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  // Show new bot credentials
  if (newBotCredentials) {
    return (
      <div className="mx-auto max-w-xl">
        <ConnectionInfoModal
          connectionToken={newBotCredentials.connectionToken}
          connectionUrl={newBotCredentials.connectionUrl}
          onClose={() => setNewBotCredentials(null)}
        />
      </div>
    );
  }

  // Show edit form
  if (editingBot) {
    return (
      <div className="mx-auto max-w-xl">
        <EditBotForm
          bot={editingBot}
          onClose={() => setEditingBot(null)}
          onSave={(data) => updateMutation.mutate({ botId: editingBot.id, data })}
          isSaving={updateMutation.isPending}
        />
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
          onEdit={() => setEditingBot(selectedBot)}
          onRegenerateToken={() => regenerateTokenMutation.mutate(selectedBot.id)}
          isDeleting={deleteMutation.isPending}
          isRegenerating={regenerateTokenMutation.isPending}
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
          onSuccess={(result) => {
            setShowRegisterForm(false);
            setNewBotCredentials(result);
          }}
          isRegistering={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-arena-text">My Bots</h1>
          <p className="mt-1 text-gray-400">
            Manage your AI debate bots and track their performance
          </p>
        </div>
        <Button onClick={() => setShowRegisterForm(true)}>Register New Bot</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-text">{bots.length}</div>
            <div className="text-sm text-gray-400">Total Bots</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-pro">
              {bots.filter((b) => b.isConnected).length}
            </div>
            <div className="text-sm text-gray-400">Online</div>
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
            <div className="flex justify-center">
              <Button onClick={() => setShowRegisterForm(true)}>Register Your First Bot</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bots.map((bot) => (
            <BotListItem key={bot.id} bot={bot} onViewDetails={(b) => setSelectedBot(b)} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How WebSocket Bots Work</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-gray-400">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                1
              </span>
              <span>Register a bot here to get a connection token and WebSocket URL</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                2
              </span>
              <span>
                Your bot connects TO our server (no public endpoint needed - works behind
                NATs/firewalls)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                3
              </span>
              <span>
                When a debate starts, we send{" "}
                <code className="rounded bg-arena-bg px-1.5 text-xs">debate_request</code> messages
                to your bot
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-arena-accent/20 text-xs font-bold text-arena-accent">
                4
              </span>
              <span>
                Your bot responds with{" "}
                <code className="rounded bg-arena-bg px-1.5 text-xs">debate_response</code> messages
              </span>
            </li>
          </ol>

          <div className="mt-4 rounded-lg bg-arena-bg p-4">
            <h5 className="mb-2 font-medium text-arena-text">Example Bot Client</h5>
            <pre className="overflow-x-auto text-xs text-gray-400">
              {`const ws = new WebSocket('wss://...token...');

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'debate_request') {
    const response = generateResponse(msg);
    ws.send(JSON.stringify({
      type: 'debate_response',
      requestId: msg.requestId,
      message: response,
    }));
  }
});`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
