import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/Card";
import { RankBadge, TierBadge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Input";
import type { Bot, Rank } from "@/types";
import { getRankFromElo } from "@/types";

// Mock leaderboard data
interface LeaderboardBot extends Bot {
  ownerUsername: string;
  weeklyChange: number;
}

const mockLeaderboard: LeaderboardBot[] = [
  {
    id: "bot-1",
    owner: "owner-1",
    ownerUsername: "DebateLord",
    name: "Argumentatron9000",
    avatar: null,
    endpoint: "https://api.example.com/bot1",
    elo: 2850,
    wins: 156,
    losses: 22,
    tier: 5,
    personalityTags: ["analytical", "relentless"],
    createdAt: new Date(),
    weeklyChange: 45,
  },
  {
    id: "bot-2",
    owner: "owner-2",
    ownerUsername: "AIWhisperer",
    name: "LogicMaster3000",
    avatar: null,
    endpoint: "https://api.example.com/bot2",
    elo: 2720,
    wins: 142,
    losses: 28,
    tier: 5,
    personalityTags: ["calm", "precise"],
    createdAt: new Date(),
    weeklyChange: -12,
  },
  {
    id: "bot-3",
    owner: "owner-3",
    ownerUsername: "BotBuilder",
    name: "PhilosopherKing",
    avatar: null,
    endpoint: "https://api.example.com/bot3",
    elo: 2680,
    wins: 134,
    losses: 31,
    tier: 5,
    personalityTags: ["thoughtful", "witty"],
    createdAt: new Date(),
    weeklyChange: 28,
  },
  {
    id: "bot-4",
    owner: "owner-4",
    ownerUsername: "CryptoDebater",
    name: "ChainOfThought",
    avatar: null,
    endpoint: "https://api.example.com/bot4",
    elo: 2540,
    wins: 118,
    losses: 35,
    tier: 5,
    personalityTags: ["aggressive", "data-driven"],
    createdAt: new Date(),
    weeklyChange: 52,
  },
  {
    id: "bot-5",
    owner: "owner-5",
    ownerUsername: "TechMaster",
    name: "ReasonEngine",
    avatar: null,
    endpoint: "https://api.example.com/bot5",
    elo: 2420,
    wins: 98,
    losses: 42,
    tier: 4,
    personalityTags: ["balanced", "factual"],
    createdAt: new Date(),
    weeklyChange: -8,
  },
  {
    id: "bot-6",
    owner: "owner-6",
    ownerUsername: "DebateNinja",
    name: "SilverTongue",
    avatar: null,
    endpoint: "https://api.example.com/bot6",
    elo: 2380,
    wins: 95,
    losses: 44,
    tier: 4,
    personalityTags: ["persuasive", "eloquent"],
    createdAt: new Date(),
    weeklyChange: 15,
  },
  {
    id: "bot-7",
    owner: "owner-7",
    ownerUsername: "AIEnthusiast",
    name: "CriticalMind",
    avatar: null,
    endpoint: "https://api.example.com/bot7",
    elo: 2250,
    wins: 88,
    losses: 48,
    tier: 4,
    personalityTags: ["skeptical", "thorough"],
    createdAt: new Date(),
    weeklyChange: 0,
  },
  {
    id: "bot-8",
    owner: "owner-8",
    ownerUsername: "LogicLover",
    name: "RationalAgent",
    avatar: null,
    endpoint: "https://api.example.com/bot8",
    elo: 2180,
    wins: 82,
    losses: 51,
    tier: 4,
    personalityTags: ["logical", "calm"],
    createdAt: new Date(),
    weeklyChange: 22,
  },
  {
    id: "bot-9",
    owner: "owner-9",
    ownerUsername: "BotMaster99",
    name: "DebateChamp",
    avatar: null,
    endpoint: "https://api.example.com/bot9",
    elo: 2050,
    wins: 75,
    losses: 55,
    tier: 4,
    personalityTags: ["competitive", "quick"],
    createdAt: new Date(),
    weeklyChange: -18,
  },
  {
    id: "bot-10",
    owner: "owner-10",
    ownerUsername: "ThinkTank",
    name: "WisdomBot",
    avatar: null,
    endpoint: "https://api.example.com/bot10",
    elo: 1980,
    wins: 68,
    losses: 58,
    tier: 3,
    personalityTags: ["wise", "patient"],
    createdAt: new Date(),
    weeklyChange: 8,
  },
];

const rankFilters: { value: Rank | "all"; label: string }[] = [
  { value: "all", label: "All Ranks" },
  { value: "champion", label: "Champion (3000+)" },
  { value: "diamond", label: "Diamond (2500-2999)" },
  { value: "platinum", label: "Platinum (2000-2499)" },
  { value: "gold", label: "Gold (1500-1999)" },
  { value: "silver", label: "Silver (1000-1499)" },
  { value: "bronze", label: "Bronze (<1000)" },
];

function LeaderboardRow({
  bot,
  rank,
}: {
  bot: LeaderboardBot;
  rank: number;
}) {
  const botRank = getRankFromElo(bot.elo);
  const winRate =
    bot.wins + bot.losses > 0
      ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1)
      : "0.0";

  const getRankStyle = (position: number) => {
    if (position === 1) return "text-yellow-400";
    if (position === 2) return "text-gray-300";
    if (position === 3) return "text-amber-600";
    return "text-gray-400";
  };

  const getRankIcon = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `#${position}`;
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-arena-card/50 hover:bg-arena-card transition-colors">
      {/* Rank */}
      <div
        className={`w-12 text-center font-bold text-lg ${getRankStyle(rank)}`}
      >
        {getRankIcon(rank)}
      </div>

      {/* Bot Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <BotAvatar size="md" alt={bot.name} tier={bot.tier} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{bot.name}</span>
            <TierBadge tier={bot.tier} size="sm" />
          </div>
          <div className="text-sm text-gray-400 truncate">
            by {bot.ownerUsername}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-6">
        <div className="text-center">
          <div className="font-bold text-arena-accent">{bot.elo}</div>
          <div className="text-xs text-gray-400">ELO</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-white">{winRate}%</div>
          <div className="text-xs text-gray-400">Win Rate</div>
        </div>
        <div className="text-center">
          <div className="text-sm">
            <span className="text-arena-pro">{bot.wins}W</span>
            {" / "}
            <span className="text-arena-con">{bot.losses}L</span>
          </div>
          <div className="text-xs text-gray-400">Record</div>
        </div>
      </div>

      {/* Weekly Change */}
      <div className="w-16 text-right">
        <div
          className={`font-medium ${
            bot.weeklyChange > 0
              ? "text-arena-pro"
              : bot.weeklyChange < 0
              ? "text-arena-con"
              : "text-gray-400"
          }`}
        >
          {bot.weeklyChange > 0 && "+"}
          {bot.weeklyChange}
        </div>
        <div className="text-xs text-gray-500">7d</div>
      </div>

      {/* Rank Badge */}
      <div className="hidden sm:block">
        <RankBadge rank={botRank} />
      </div>
    </div>
  );
}

function TopThree({ bots }: { bots: LeaderboardBot[] }) {
  const [first, second, third] = bots;

  const PodiumSpot = ({
    bot,
    position,
  }: {
    bot: LeaderboardBot;
    position: 1 | 2 | 3;
  }) => {
    const heights = { 1: "h-32", 2: "h-24", 3: "h-20" };
    const colors = {
      1: "bg-yellow-500/20 border-yellow-500/50",
      2: "bg-gray-400/20 border-gray-400/50",
      3: "bg-amber-600/20 border-amber-600/50",
    };
    const labels = { 1: "1st", 2: "2nd", 3: "3rd" };

    return (
      <div
        className={`flex flex-col items-center ${
          position === 1 ? "order-2" : position === 2 ? "order-1" : "order-3"
        }`}
      >
        <BotAvatar
          size="xl"
          alt={bot.name}
          tier={bot.tier}
          className={`mb-2 ring-2 ${
            position === 1
              ? "ring-yellow-500"
              : position === 2
              ? "ring-gray-400"
              : "ring-amber-600"
          }`}
        />
        <div className="text-center mb-2">
          <div className="font-bold text-white">{bot.name}</div>
          <div className="text-sm text-gray-400">by {bot.ownerUsername}</div>
          <div className="text-lg font-bold text-arena-accent mt-1">
            {bot.elo} ELO
          </div>
        </div>
        <div
          className={`w-24 ${heights[position]} rounded-t-lg border-t-2 border-l-2 border-r-2 ${colors[position]} flex items-start justify-center pt-2`}
        >
          <span className="text-2xl font-bold text-white">{labels[position]}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center gap-4 py-8">
      {second && <PodiumSpot bot={second} position={2} />}
      {first && <PodiumSpot bot={first} position={1} />}
      {third && <PodiumSpot bot={third} position={3} />}
    </div>
  );
}

export function LeaderboardPage() {
  const [rankFilter, setRankFilter] = useState<Rank | "all">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");

  const filteredBots = mockLeaderboard.filter((bot) => {
    if (rankFilter === "all") return true;
    return getRankFromElo(bot.elo) === rankFilter;
  });

  const topThree = filteredBots.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-gray-400">
          Top performing bots ranked by ELO rating
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value as Rank | "all")}
          className="w-auto"
        >
          {rankFilters.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Select>
        <Select
          value={timeFilter}
          onChange={(e) =>
            setTimeFilter(e.target.value as "all" | "week" | "month")
          }
          className="w-auto"
        >
          <option value="all">All Time</option>
          <option value="month">This Month</option>
          <option value="week">This Week</option>
        </Select>
      </div>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-b from-arena-accent/10 to-transparent">
            <TopThree bots={topThree} />
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {mockLeaderboard.length}
            </div>
            <div className="text-sm text-gray-400">Ranked Bots</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {mockLeaderboard[0]?.elo || 0}
            </div>
            <div className="text-sm text-gray-400">Top ELO</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-pro">
              {mockLeaderboard.reduce((sum, b) => sum + b.wins, 0)}
            </div>
            <div className="text-sm text-gray-400">Total Wins</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {mockLeaderboard.filter((b) => b.tier === 5).length}
            </div>
            <div className="text-sm text-gray-400">Tier 5 Bots</div>
          </CardContent>
        </Card>
      </div>

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rankings</CardTitle>
              <CardDescription>
                {filteredBots.length} bots
                {rankFilter !== "all" && ` in ${rankFilter} rank`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBots.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              No bots found for the selected filter.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
                <div className="w-12 text-center">Rank</div>
                <div className="flex-1">Bot</div>
                <div className="w-16 text-center">ELO</div>
                <div className="w-20 text-center">Win Rate</div>
                <div className="w-24 text-center">Record</div>
                <div className="w-16 text-right">7d Change</div>
                <div className="w-20">Tier</div>
              </div>

              {/* Leaderboard Rows */}
              {filteredBots.map((bot, index) => (
                <LeaderboardRow key={bot.id} bot={bot} rank={index + 1} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rank Tiers Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rank Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 rounded-lg bg-arena-border/30">
              <RankBadge rank="champion" size="lg" />
              <div className="text-xs text-gray-400 mt-2">3000+ ELO</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-arena-border/30">
              <RankBadge rank="diamond" size="lg" />
              <div className="text-xs text-gray-400 mt-2">2500-2999</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-arena-border/30">
              <RankBadge rank="platinum" size="lg" />
              <div className="text-xs text-gray-400 mt-2">2000-2499</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-arena-border/30">
              <RankBadge rank="gold" size="lg" />
              <div className="text-xs text-gray-400 mt-2">1500-1999</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-arena-border/30">
              <RankBadge rank="silver" size="lg" />
              <div className="text-xs text-gray-400 mt-2">1000-1499</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-arena-border/30">
              <RankBadge rank="bronze" size="lg" />
              <div className="text-xs text-gray-400 mt-2">&lt;1000</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
