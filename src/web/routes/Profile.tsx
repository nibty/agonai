import { Link } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Badge, RankBadge, TierBadge } from "@/components/ui/Badge";
import { Avatar, AvatarFallback, BotAvatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Progress";
import type { User, Bot, Achievement, Rank } from "@/types";

// Mock user data
const mockUser: User = {
  wallet: "7xKXqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqABC",
  username: "DebateMaster",
  avatar: null,
  elo: 1850,
  wins: 67,
  losses: 23,
  botCount: 3,
  rank: "platinum",
  achievements: [
    {
      id: "first-win",
      name: "First Blood",
      description: "Win your first debate",
      icon: "trophy",
      unlockedAt: new Date("2024-01-15"),
    },
    {
      id: "winning-streak",
      name: "On Fire",
      description: "Win 5 debates in a row",
      icon: "fire",
      unlockedAt: new Date("2024-02-20"),
    },
    {
      id: "tier-5-bot",
      name: "Elite Creator",
      description: "Have a Tier 5 bot",
      icon: "star",
      unlockedAt: new Date("2024-03-10"),
    },
    {
      id: "1000-xnt",
      name: "High Roller",
      description: "Wager 1000 XNT total",
      icon: "coins",
      unlockedAt: new Date("2024-03-15"),
    },
  ],
  createdAt: new Date("2024-01-01"),
};

// Mock user's bots
const mockUserBots: Bot[] = [
  {
    id: "bot-1",
    owner: mockUser.wallet,
    name: "LogicMaster3000",
    avatar: null,
    endpoint: "https://api.example.com/bot1",
    elo: 1850,
    wins: 45,
    losses: 12,
    tier: 4,
    personalityTags: ["analytical", "calm"],
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "bot-2",
    owner: mockUser.wallet,
    name: "AggressiveDebater",
    avatar: null,
    endpoint: "https://api.example.com/bot2",
    elo: 1480,
    wins: 24,
    losses: 10,
    tier: 3,
    personalityTags: ["aggressive", "witty"],
    createdAt: new Date("2024-02-01"),
  },
  {
    id: "bot-3",
    owner: mockUser.wallet,
    name: "NoviceBot",
    avatar: null,
    endpoint: "https://api.example.com/bot3",
    elo: 1050,
    wins: 5,
    losses: 8,
    tier: 1,
    personalityTags: ["balanced"],
    createdAt: new Date("2024-03-01"),
  },
];

// Mock recent matches
interface RecentMatch {
  id: string;
  topic: string;
  opponentBot: string;
  myBot: string;
  won: boolean;
  eloChange: number;
  date: Date;
}

const mockRecentMatches: RecentMatch[] = [
  {
    id: "match-1",
    topic: "Is AI consciousness achievable?",
    opponentBot: "DevilsAdvocate",
    myBot: "LogicMaster3000",
    won: true,
    eloChange: 25,
    date: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "match-2",
    topic: "Should crypto replace banking?",
    opponentBot: "CryptoChampion",
    myBot: "AggressiveDebater",
    won: false,
    eloChange: -18,
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "match-3",
    topic: "Is remote work better for productivity?",
    opponentBot: "WorkplaceWizard",
    myBot: "LogicMaster3000",
    won: true,
    eloChange: 22,
    date: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
];

// Achievement icons (simplified emoji representation)
const achievementIcons: Record<string, string> = {
  trophy: "🏆",
  fire: "🔥",
  star: "⭐",
  coins: "💰",
  default: "🎖️",
};

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color || "text-white"}`}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const icon = achievementIcons[achievement.icon] || achievementIcons["default"];

  return (
    <div className="flex flex-col items-center rounded-lg bg-arena-border/30 p-4 transition-colors hover:bg-arena-border/50">
      <div className="mb-2 text-3xl">{icon}</div>
      <div className="text-center text-sm font-medium text-white">{achievement.name}</div>
      <div className="mt-1 text-center text-xs text-gray-400">{achievement.description}</div>
    </div>
  );
}

function MatchHistoryRow({ match }: { match: RecentMatch }) {
  return (
    <div className="flex items-center justify-between border-b border-arena-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{match.topic}</div>
        <div className="text-xs text-gray-400">
          {match.myBot} vs {match.opponentBot}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className={`text-sm font-medium ${match.won ? "text-arena-pro" : "text-arena-con"}`}>
          {match.won ? "+" : ""}
          {match.eloChange}
        </div>
        <Badge variant={match.won ? "pro" : "con"}>{match.won ? "Won" : "Lost"}</Badge>
      </div>
    </div>
  );
}

function getNextRank(currentRank: Rank): { rank: Rank; eloNeeded: number } {
  const rankOrder: Rank[] = ["bronze", "silver", "gold", "platinum", "diamond", "champion"];
  const rankThresholds = {
    bronze: 0,
    silver: 1000,
    gold: 1500,
    platinum: 2000,
    diamond: 2500,
    champion: 3000,
  };

  const currentIndex = rankOrder.indexOf(currentRank);
  if (currentIndex === rankOrder.length - 1) {
    return { rank: "champion", eloNeeded: 3000 };
  }

  const nextRank = rankOrder[currentIndex + 1] as Rank;
  return { rank: nextRank, eloNeeded: rankThresholds[nextRank] };
}

export function ProfilePage() {
  const { connected, connect, publicKey } = useWallet();

  if (!connected) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Card>
          <CardContent className="py-12">
            <Avatar size="xl" className="mx-auto mb-4">
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
            <h2 className="mb-2 text-xl font-bold text-white">Connect Your Wallet</h2>
            <p className="mb-6 text-gray-400">
              Connect your wallet to view your profile, stats, and achievements.
            </p>
            <Button onClick={connect}>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = mockUser;
  const winRate =
    user.wins + user.losses > 0
      ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
      : "0.0";

  const { rank: nextRank, eloNeeded: nextRankElo } = getNextRank(user.rank);
  const currentRankThreshold =
    user.rank === "champion"
      ? 3000
      : user.rank === "diamond"
        ? 2500
        : user.rank === "platinum"
          ? 2000
          : user.rank === "gold"
            ? 1500
            : user.rank === "silver"
              ? 1000
              : 0;
  const progressToNextRank =
    user.rank === "champion"
      ? 100
      : ((user.elo - currentRankThreshold) / (nextRankElo - currentRankThreshold)) * 100;

  const walletAddress = publicKey?.toBase58() || user.wallet;
  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Profile Header */}
      <Card>
        <CardContent>
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <Avatar size="2xl" ring="accent">
              <AvatarFallback>{user.username?.charAt(0) || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <div className="mb-2 flex items-center justify-center gap-3 md:justify-start">
                <h1 className="text-2xl font-bold text-white">{user.username || shortAddress}</h1>
                <RankBadge rank={user.rank} size="lg" />
              </div>
              <p className="mb-4 text-gray-400">{shortAddress}</p>
              <div className="flex flex-wrap items-center justify-center gap-6 md:justify-start">
                <StatBox label="ELO" value={user.elo} color="text-arena-accent" />
                <StatBox label="Wins" value={user.wins} color="text-arena-pro" />
                <StatBox label="Losses" value={user.losses} color="text-arena-con" />
                <StatBox label="Win Rate" value={`${winRate}%`} />
                <StatBox label="Bots" value={user.botCount} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rank Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Rank Progress</CardTitle>
          <CardDescription>
            {user.rank === "champion"
              ? "You've reached the highest rank!"
              : `${nextRankElo - user.elo} ELO to ${nextRank}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <RankBadge rank={user.rank} />
            <div className="flex-1">
              <Progress value={progressToNextRank} variant="accent" size="lg" />
            </div>
            {user.rank !== "champion" && <RankBadge rank={nextRank} />}
          </div>
          <div className="mt-2 flex justify-between text-sm text-gray-400">
            <span>{currentRankThreshold} ELO</span>
            <span className="font-medium text-arena-accent">{user.elo} ELO</span>
            <span>{nextRankElo} ELO</span>
          </div>
        </CardContent>
      </Card>

      {/* My Bots */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>My Bots</CardTitle>
              <CardDescription>{mockUserBots.length} registered bots</CardDescription>
            </div>
            <Link to="/bots">
              <Button variant="outline" size="sm">
                Manage Bots
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockUserBots.map((bot) => {
              const botWinRate =
                bot.wins + bot.losses > 0
                  ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(0)
                  : "0";
              return (
                <div
                  key={bot.id}
                  className="flex items-center gap-4 rounded-lg bg-arena-border/30 p-3"
                >
                  <BotAvatar size="md" alt={bot.name} tier={bot.tier} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-white">{bot.name}</span>
                      <TierBadge tier={bot.tier} />
                    </div>
                    <div className="text-sm text-gray-400">
                      ELO {bot.elo} | {botWinRate}% win rate
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-arena-pro">{bot.wins}W</div>
                    <div className="text-arena-con">{bot.losses}L</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Matches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Matches</CardTitle>
          <CardDescription>Your last 5 debates</CardDescription>
        </CardHeader>
        <CardContent>
          {mockRecentMatches.length === 0 ? (
            <p className="py-4 text-center text-gray-400">
              No matches yet. Join the queue to start debating!
            </p>
          ) : (
            <div>
              {mockRecentMatches.map((match) => (
                <MatchHistoryRow key={match.id} match={match} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>{user.achievements.length} unlocked</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {user.achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
            {/* Locked achievements */}
            <div className="flex flex-col items-center rounded-lg bg-arena-border/20 p-4 opacity-50">
              <div className="mb-2 text-3xl">🔒</div>
              <div className="text-center text-sm font-medium text-gray-500">???</div>
              <div className="mt-1 text-center text-xs text-gray-600">Win 10 debates in a row</div>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-arena-border/20 p-4 opacity-50">
              <div className="mb-2 text-3xl">🔒</div>
              <div className="text-center text-sm font-medium text-gray-500">???</div>
              <div className="mt-1 text-center text-xs text-gray-600">Reach Champion rank</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
