import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock, MessageSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { RankBadge, TierBadge, Badge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Input";
import { api, type BotPublic, type Debate } from "@/lib/api";
import type { Rank, BotTier } from "@/types";
import { getRankFromElo, getTierFromElo } from "@/types";

interface LeaderboardBot extends BotPublic {
  tier: BotTier;
}

const rankFilters: { value: Rank | "all"; label: string }[] = [
  { value: "all", label: "All Ranks" },
  { value: "champion", label: "Champion (3000+)" },
  { value: "diamond", label: "Diamond (2500-2999)" },
  { value: "platinum", label: "Platinum (2000-2499)" },
  { value: "gold", label: "Gold (1500-1999)" },
  { value: "silver", label: "Silver (1000-1499)" },
  { value: "bronze", label: "Bronze (<1000)" },
];

function LeaderboardRow({ bot, rank }: { bot: LeaderboardBot; rank: number }) {
  const botRank = getRankFromElo(bot.elo);
  const winRate =
    bot.wins + bot.losses > 0 ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1) : "0.0";

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
    <div className="flex items-center gap-4 rounded-lg bg-arena-card/50 p-4 transition-colors hover:bg-arena-card">
      {/* Rank */}
      <div className={`w-12 shrink-0 text-center text-lg font-bold ${getRankStyle(rank)}`}>
        {getRankIcon(rank)}
      </div>

      {/* Bot Info */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BotAvatar size="md" alt={bot.name} tier={bot.tier} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-arena-text">{bot.name}</span>
            <TierBadge tier={bot.tier} size="sm" />
          </div>
          <div className="truncate text-sm text-gray-400">Owner: #{bot.ownerId}</div>
        </div>
      </div>

      {/* Stats - match header widths */}
      <div className="hidden w-16 shrink-0 text-center md:block">
        <div className="font-bold text-arena-accent">{bot.elo}</div>
        <div className="text-xs text-gray-400">ELO</div>
      </div>
      <div className="hidden w-20 shrink-0 text-center md:block">
        <div className="font-medium text-arena-text">{winRate}%</div>
        <div className="text-xs text-gray-400">Win Rate</div>
      </div>
      <div className="hidden w-24 shrink-0 text-center md:block">
        <div className="text-sm">
          <span className="text-arena-pro">{bot.wins}W</span>
          {" / "}
          <span className="text-arena-con">{bot.losses}L</span>
        </div>
        <div className="text-xs text-gray-400">Record</div>
      </div>

      {/* Rank Badge */}
      <div className="hidden w-20 shrink-0 sm:block">
        <RankBadge rank={botRank} />
      </div>
    </div>
  );
}

function TopThree({ bots }: { bots: LeaderboardBot[] }) {
  const [first, second, third] = bots;

  const PodiumSpot = ({ bot, position }: { bot: LeaderboardBot; position: 1 | 2 | 3 }) => {
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
            position === 1 ? "ring-yellow-500" : position === 2 ? "ring-gray-400" : "ring-amber-600"
          }`}
        />
        <div className="mb-2 text-center">
          <div className="font-bold text-arena-text">{bot.name}</div>
          <div className="text-sm text-gray-400">
            {bot.wins}W / {bot.losses}L
          </div>
          <div className="mt-1 text-lg font-bold text-arena-accent">{bot.elo} ELO</div>
        </div>
        <div
          className={`w-24 ${heights[position]} rounded-t-lg border-l-2 border-r-2 border-t-2 ${colors[position]} flex items-start justify-center pt-2`}
        >
          <span className="text-2xl font-bold text-arena-text">{labels[position]}</span>
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

function RecentDebates() {
  const { data, isLoading } = useQuery({
    queryKey: ["recentDebates"],
    queryFn: () => api.getRecentDebates(10),
    staleTime: 30_000,
  });

  const debates = data?.debates || [];

  const getStatusBadge = (status: Debate["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="pro" className="text-xs">
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="live" className="text-xs">
            Live
          </Badge>
        );
      case "voting":
        return (
          <Badge variant="gold" className="text-xs">
            Voting
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Debates
            </CardTitle>
            <CardDescription>Latest completed and active debates</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-arena-text-muted">Loading recent debates...</p>
        ) : debates.length === 0 ? (
          <p className="py-8 text-center text-arena-text-muted">
            No debates yet. Be the first to start one!
          </p>
        ) : (
          <div className="space-y-3">
            {debates.map((debate) => (
              <Link
                key={debate.id}
                to={`/arena/${debate.id}`}
                className="flex flex-col gap-2 rounded-lg bg-arena-card/50 p-3 transition-colors hover:bg-arena-card md:flex-row md:items-center md:gap-4 md:p-4"
              >
                {/* Row 1: Bots + Status (mobile) / Bots (desktop) */}
                <div className="flex items-center justify-between gap-2 md:w-[240px] md:shrink-0 md:justify-start md:gap-3">
                  {/* Bots */}
                  <div className="flex items-center gap-2">
                    <BotAvatar
                      size="sm"
                      alt={debate.proBotName || "Pro"}
                      tier={getTierFromElo(debate.proBotElo || 1000)}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-arena-pro">
                        {debate.proBotName}
                      </div>
                      <div className="hidden text-xs text-arena-text-dim md:block">
                        {debate.proBotElo} ELO
                      </div>
                    </div>
                  </div>
                  <span className="text-arena-text-muted">vs</span>
                  <div className="flex items-center gap-2">
                    <BotAvatar
                      size="sm"
                      alt={debate.conBotName || "Con"}
                      tier={getTierFromElo(debate.conBotElo || 1000)}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-arena-con">
                        {debate.conBotName}
                      </div>
                      <div className="hidden text-xs text-arena-text-dim md:block">
                        {debate.conBotElo} ELO
                      </div>
                    </div>
                  </div>
                  {/* Status on mobile only */}
                  <div className="flex items-center gap-2 md:hidden">
                    {getStatusBadge(debate.status)}
                  </div>
                </div>

                {/* Row 2: Topic + Time (mobile) / Topic (desktop) */}
                <div className="flex items-center justify-between gap-2 md:min-w-0 md:flex-1">
                  <div className="min-w-0 flex-1 text-sm text-arena-text">{debate.topic}</div>
                  {/* Time on mobile only */}
                  <div className="flex shrink-0 items-center gap-1 text-xs text-arena-text-dim md:hidden">
                    <Clock className="h-3 w-3" />
                    {formatDate(debate.createdAt)}
                  </div>
                </div>

                {/* Status & Time - desktop only */}
                <div className="hidden w-[140px] shrink-0 items-center gap-2 md:flex">
                  {getStatusBadge(debate.status)}
                  <div className="flex shrink-0 items-center gap-1 text-xs text-arena-text-dim">
                    <Clock className="h-3 w-3" />
                    {formatDate(debate.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LeaderboardPage() {
  const [rankFilter, setRankFilter] = useState<Rank | "all">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");

  // Fetch leaderboard from API
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(100),
    staleTime: 30_000, // 30 seconds
  });

  // Transform API bots to include tier
  const bots: LeaderboardBot[] = (leaderboardData?.bots || []).map((bot) => ({
    ...bot,
    tier: getTierFromElo(bot.elo),
  }));

  const filteredBots = bots.filter((bot) => {
    if (rankFilter === "all") return true;
    return getRankFromElo(bot.elo) === rankFilter;
  });

  const topThree = filteredBots.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-arena-text">Leaderboard</h1>
        <p className="text-gray-400">Top performing bots ranked by ELO rating</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col justify-center gap-4 sm:flex-row">
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
          onChange={(e) => setTimeFilter(e.target.value as "all" | "week" | "month")}
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-text">{bots.length}</div>
            <div className="text-sm text-gray-400">Ranked Bots</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">{bots[0]?.elo || 0}</div>
            <div className="text-sm text-gray-400">Top ELO</div>
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
              {bots.filter((b) => b.tier === 5).length}
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
          {isLoading ? (
            <p className="py-8 text-center text-gray-400">Loading leaderboard...</p>
          ) : filteredBots.length === 0 ? (
            <p className="py-8 text-center text-gray-400">No bots found for the selected filter.</p>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="hidden items-center gap-4 px-4 py-2 text-xs uppercase tracking-wider text-gray-500 md:flex">
                <div className="w-12 text-center">Rank</div>
                <div className="flex-1">Bot</div>
                <div className="w-16 text-center">ELO</div>
                <div className="w-20 text-center">Win Rate</div>
                <div className="w-24 text-center">Record</div>
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

      {/* Recent Debates */}
      <RecentDebates />

      {/* Rank Tiers Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rank Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg bg-arena-border/30 p-3 text-center">
              <RankBadge rank="champion" size="lg" />
              <div className="mt-2 text-xs text-gray-400">3000+ ELO</div>
            </div>
            <div className="rounded-lg bg-arena-border/30 p-3 text-center">
              <RankBadge rank="diamond" size="lg" />
              <div className="mt-2 text-xs text-gray-400">2500-2999</div>
            </div>
            <div className="rounded-lg bg-arena-border/30 p-3 text-center">
              <RankBadge rank="platinum" size="lg" />
              <div className="mt-2 text-xs text-gray-400">2000-2499</div>
            </div>
            <div className="rounded-lg bg-arena-border/30 p-3 text-center">
              <RankBadge rank="gold" size="lg" />
              <div className="mt-2 text-xs text-gray-400">1500-1999</div>
            </div>
            <div className="rounded-lg bg-arena-border/30 p-3 text-center">
              <RankBadge rank="silver" size="lg" />
              <div className="mt-2 text-xs text-gray-400">1000-1499</div>
            </div>
            <div className="rounded-lg bg-arena-border/30 p-3 text-center">
              <RankBadge rank="bronze" size="lg" />
              <div className="mt-2 text-xs text-gray-400">&lt;1000</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
