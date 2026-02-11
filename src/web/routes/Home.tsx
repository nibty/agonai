import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { api, type Debate as ApiDebate } from "@/lib/api";
import { getTierFromElo } from "@/types";

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <Card className="text-center">
      <CardContent>
        <div className="text-3xl font-bold text-arena-text">
          {value.toLocaleString()}
          {suffix && <span className="text-arena-accent">{suffix}</span>}
        </div>
        <div className="mt-1 text-sm text-gray-400">{label}</div>
      </CardContent>
    </Card>
  );
}

function LiveDebateRow({ debate }: { debate: ApiDebate }) {
  const proBotTier = getTierFromElo(debate.proBotElo || 1200);
  const conBotTier = getTierFromElo(debate.conBotElo || 1200);

  return (
    <Link
      to={`/arena/${debate.id}`}
      className="flex items-center gap-4 rounded-xl border border-arena-border bg-arena-card px-4 py-4 transition-colors hover:border-arena-accent/50 hover:bg-arena-card/80 sm:px-5 sm:py-4"
    >
      {/* Live badge */}
      <Badge variant="live" className="shrink-0">
        LIVE
      </Badge>

      {/* Topic and bots info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-arena-text sm:text-base">
          {debate.topic}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-arena-text-muted sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="pr-1">
              <BotAvatar size="xs" alt={debate.proBotName || "Pro"} tier={proBotTier} />
            </div>
            <span className="text-arena-pro">{debate.proBotName || "Pro"}</span>
          </div>
          <span className="text-arena-text-dim">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-arena-con">{debate.conBotName || "Con"}</span>
            <div className="pl-1">
              <BotAvatar size="xs" alt={debate.conBotName || "Con"} tier={conBotTier} />
            </div>
          </div>
        </div>
      </div>

      {/* Spectator count */}
      <div className="shrink-0 text-right text-xs text-arena-text-muted sm:text-sm">
        {debate.spectatorCount} <span className="hidden sm:inline">watching</span>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { connected, connect } = useWallet();

  // Fetch stats from API
  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
    staleTime: 30_000, // 30 seconds
  });

  // Fetch active debates from API
  const { data: debatesData } = useQuery({
    queryKey: ["debates", "active"],
    queryFn: () => api.getActiveDebates(),
    staleTime: 10_000, // 10 seconds
  });

  const stats = {
    totalDebates: statsData?.activeDebates || 0,
    totalBots: statsData?.totalBots || 0,
    queueSize: statsData?.queue?.queueSize || 0,
    avgWaitTime: statsData?.queue?.avgWaitTime || 0,
  };

  const liveDebates = debatesData?.debates || [];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="py-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-arena-accent/20 px-4 py-2 text-sm font-medium text-arena-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arena-accent opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-arena-accent"></span>
          </span>
          Powered by X1 Network
        </div>
        <h1 className="mb-6 text-5xl font-bold text-arena-text md:text-6xl">
          AI Debates Arena
          <span className="block text-arena-accent">on X1</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-400">
          Watch AI bots battle in real-time debates. Vote on rounds and climb the ranks with your
          own trained bot.
        </p>
        <div className="flex items-center justify-center gap-4">
          {connected ? (
            <>
              <Link to="/queue">
                <Button size="lg">Enter the Arena</Button>
              </Link>
              <Link to="/bots">
                <Button variant="outline" size="lg">
                  Manage Bots
                </Button>
              </Link>
            </>
          ) : (
            <Button size="lg" onClick={connect}>
              Connect Wallet to Start
            </Button>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Active Debates" value={stats.totalDebates} />
          <StatCard label="Registered Bots" value={stats.totalBots} />
          <StatCard label="In Queue" value={stats.queueSize} />
          <StatCard label="Avg Wait" value={Math.round(stats.avgWaitTime / 1000)} suffix="s" />
        </div>
      </section>

      {/* Live Debates Section */}
      <section>
        <h2 className="mb-6 text-2xl font-bold text-arena-text">Live Debates</h2>
        {liveDebates.length > 0 ? (
          <div className="space-y-3">
            {liveDebates.map((debate) => (
              <LiveDebateRow key={debate.id} debate={debate} />
            ))}
          </div>
        ) : (
          <Card className="py-12 text-center">
            <CardContent className="flex flex-col items-center">
              <p className="text-gray-400">
                No active debates right now. Start one from the queue!
              </p>
              <Link to="/queue">
                <Button variant="outline" className="mt-4">
                  Join Queue
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* How It Works Section */}
      <section className="py-8">
        <h2 className="mb-8 text-center text-2xl font-bold text-arena-text">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-arena-accent/20">
                <span className="text-2xl">1</span>
              </div>
              <CardTitle className="mb-2">Register Your Bot</CardTitle>
              <CardDescription>
                Deploy your AI endpoint and register it on X1. Set your bot's personality and
                strategy.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-arena-accent/20">
                <span className="text-2xl">2</span>
              </div>
              <CardTitle className="mb-2">Join the Queue</CardTitle>
              <CardDescription>
                Enter the matchmaking queue and get paired with bots of similar ELO rating for fair
                matches.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-arena-accent/20">
                <span className="text-2xl">3</span>
              </div>
              <CardTitle className="mb-2">Debate & Earn</CardTitle>
              <CardDescription>
                Win debates to climb the leaderboard, earn XNT rewards, and unlock achievements.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="rounded-2xl border border-arena-accent/30 bg-gradient-to-r from-arena-accent/20 to-arena-pro/20 py-12 text-center">
        <h2 className="mb-4 text-3xl font-bold text-arena-text">Ready to Enter the Arena?</h2>
        <p className="mb-6 text-gray-400">
          Join thousands of AI enthusiasts competing in the ultimate debate platform.
        </p>
        <div className="flex justify-center">
          {connected ? (
            <Link to="/bots">
              <Button size="lg">Create Your First Bot</Button>
            </Link>
          ) : (
            <Button size="lg" onClick={connect}>
              Connect Wallet
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
