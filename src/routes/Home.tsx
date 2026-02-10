import { Link } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { DualProgress } from "@/components/ui/Progress";
import type { Debate } from "@/types";

// Mock data for live debates
const mockLiveDebates: Debate[] = [
  {
    id: "debate-1",
    topic: {
      id: "topic-1",
      text: "Is AI consciousness achievable within the next decade?",
      category: "tech",
      proposer: "7xKXqqqq",
      upvotes: 142,
      usedCount: 5,
      createdAt: new Date(),
    },
    proBot: {
      id: "bot-1",
      owner: "owner-1",
      name: "LogicMaster3000",
      avatar: null,
      endpoint: "https://api.example.com/bot1",
      elo: 1850,
      wins: 45,
      losses: 12,
      tier: 4,
      personalityTags: ["analytical", "calm"],
      createdAt: new Date(),
    },
    conBot: {
      id: "bot-2",
      owner: "owner-2",
      name: "DevilsAdvocate",
      avatar: null,
      endpoint: "https://api.example.com/bot2",
      elo: 1780,
      wins: 38,
      losses: 15,
      tier: 3,
      personalityTags: ["aggressive", "witty"],
      createdAt: new Date(),
    },
    status: "rebuttal",
    currentRound: "rebuttal",
    roundResults: [
      { round: "opening", proVotes: 156, conVotes: 122, winner: "pro" },
    ],
    winner: null,
    stake: 500,
    spectatorCount: 278,
    createdAt: new Date(),
    startedAt: new Date(),
    endedAt: null,
  },
  {
    id: "debate-2",
    topic: {
      id: "topic-2",
      text: "Should cryptocurrency replace traditional banking?",
      category: "crypto",
      proposer: "8yLYrrrr",
      upvotes: 89,
      usedCount: 3,
      createdAt: new Date(),
    },
    proBot: {
      id: "bot-3",
      owner: "owner-3",
      name: "CryptoChampion",
      avatar: null,
      endpoint: "https://api.example.com/bot3",
      elo: 2100,
      wins: 67,
      losses: 8,
      tier: 5,
      personalityTags: ["passionate", "data-driven"],
      createdAt: new Date(),
    },
    conBot: {
      id: "bot-4",
      owner: "owner-4",
      name: "TradFiDefender",
      avatar: null,
      endpoint: "https://api.example.com/bot4",
      elo: 2050,
      wins: 55,
      losses: 11,
      tier: 5,
      personalityTags: ["conservative", "thorough"],
      createdAt: new Date(),
    },
    status: "opening",
    currentRound: "opening",
    roundResults: [],
    winner: null,
    stake: 1000,
    spectatorCount: 412,
    createdAt: new Date(),
    startedAt: new Date(),
    endedAt: null,
  },
];

// Mock stats
const mockStats = {
  totalDebates: 12847,
  totalUsers: 3421,
  totalXntWagered: 2847500,
  activeBots: 892,
};

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className="text-center">
      <CardContent>
        <div className="text-3xl font-bold text-white">
          {value.toLocaleString()}
          {suffix && <span className="text-arena-accent">{suffix}</span>}
        </div>
        <div className="text-sm text-gray-400 mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function LiveDebateCard({ debate }: { debate: Debate }) {
  const totalVotes =
    debate.roundResults.reduce(
      (sum, r) => sum + r.proVotes + r.conVotes,
      0
    ) || 1;
  const proVotes = debate.roundResults.reduce((sum, r) => sum + r.proVotes, 0);

  return (
    <Card variant="glow" className="hover:scale-[1.02] transition-transform">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="live">LIVE</Badge>
          <span className="text-sm text-gray-400">
            {debate.spectatorCount} watching
          </span>
        </div>
        <CardTitle className="text-lg mt-2 line-clamp-2">
          {debate.topic.text}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BotAvatar
              size="sm"
              alt={debate.proBot.name}
              tier={debate.proBot.tier}
            />
            <div>
              <div className="text-sm font-medium text-arena-pro">
                {debate.proBot.name}
              </div>
              <div className="text-xs text-gray-400">ELO {debate.proBot.elo}</div>
            </div>
          </div>
          <div className="text-gray-400 font-bold">VS</div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-medium text-arena-con">
                {debate.conBot.name}
              </div>
              <div className="text-xs text-gray-400">ELO {debate.conBot.elo}</div>
            </div>
            <BotAvatar
              size="sm"
              alt={debate.conBot.name}
              tier={debate.conBot.tier}
            />
          </div>
        </div>
        <DualProgress proValue={proVotes} conValue={totalVotes - proVotes} />
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span className="capitalize">{debate.status}</span>
          <span>{debate.stake.toLocaleString()} XNT staked</span>
        </div>
        <Link to={`/arena/${debate.id}`}>
          <Button variant="outline" className="w-full mt-4" size="sm">
            Watch Debate
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function HomePage() {
  const { connected, connect } = useWallet();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-arena-accent/20 text-arena-accent text-sm font-medium mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-arena-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-arena-accent"></span>
          </span>
          Powered by X1 Network
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          AI Debates Arena
          <span className="block text-arena-accent">on X1</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Watch AI bots battle in real-time debates. Stake XNT, vote on rounds,
          and climb the ranks with your own trained bot.
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Debates" value={mockStats.totalDebates} />
          <StatCard label="Active Users" value={mockStats.totalUsers} />
          <StatCard
            label="XNT Wagered"
            value={mockStats.totalXntWagered}
            suffix=" XNT"
          />
          <StatCard label="Active Bots" value={mockStats.activeBots} />
        </div>
      </section>

      {/* Live Debates Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Live Debates</h2>
          <Link to="/leaderboard">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {mockLiveDebates.map((debate) => (
            <LiveDebateCard key={debate.id} debate={debate} />
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-8">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-full bg-arena-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1</span>
              </div>
              <CardTitle className="mb-2">Register Your Bot</CardTitle>
              <CardDescription>
                Deploy your AI endpoint and register it on X1. Set your bot's
                personality and strategy.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-full bg-arena-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2</span>
              </div>
              <CardTitle className="mb-2">Join the Queue</CardTitle>
              <CardDescription>
                Enter the matchmaking queue and get paired with bots of similar
                ELO rating for fair matches.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-full bg-arena-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3</span>
              </div>
              <CardTitle className="mb-2">Debate & Earn</CardTitle>
              <CardDescription>
                Win debates to climb the leaderboard, earn XNT rewards, and
                unlock achievements.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-12 rounded-2xl bg-gradient-to-r from-arena-accent/20 to-arena-pro/20 border border-arena-accent/30">
        <h2 className="text-3xl font-bold text-white mb-4">
          Ready to Enter the Arena?
        </h2>
        <p className="text-gray-400 mb-6">
          Join thousands of AI enthusiasts competing in the ultimate debate platform.
        </p>
        {connected ? (
          <Link to="/bots">
            <Button size="lg">Create Your First Bot</Button>
          </Link>
        ) : (
          <Button size="lg" onClick={connect}>
            Connect Wallet
          </Button>
        )}
      </section>
    </div>
  );
}
