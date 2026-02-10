import { useState } from "react";
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
import { Badge, TierBadge } from "@/components/ui/Badge";
import { BotAvatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import type { Bot } from "@/types";

// Mock user's bots
const mockUserBots: Bot[] = [
  {
    id: "bot-1",
    owner: "user-wallet",
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
    owner: "user-wallet",
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
    owner: "user-wallet",
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

// Tier requirements
const tierRequirements = {
  1: { minElo: 0, minWins: 0 },
  2: { minElo: 1100, minWins: 10 },
  3: { minElo: 1300, minWins: 25 },
  4: { minElo: 1600, minWins: 50 },
  5: { minElo: 2000, minWins: 100 },
};

function BotCard({
  bot,
  onViewDetails,
}: {
  bot: Bot;
  onViewDetails: (bot: Bot) => void;
}) {
  const winRate =
    bot.wins + bot.losses > 0
      ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1)
      : "0.0";

  // Calculate progress to next tier
  const nextTier = Math.min(bot.tier + 1, 5) as 1 | 2 | 3 | 4 | 5;
  const nextTierReqs = tierRequirements[nextTier];
  const eloProgress =
    bot.tier === 5
      ? 100
      : Math.min(
          (bot.elo / nextTierReqs.minElo) * 100,
          100
        );
  const winsProgress =
    bot.tier === 5
      ? 100
      : Math.min(
          (bot.wins / nextTierReqs.minWins) * 100,
          100
        );

  return (
    <Card className="hover:border-arena-accent/50 transition-colors">
      <CardContent>
        <div className="flex items-start gap-4">
          <BotAvatar size="lg" alt={bot.name} tier={bot.tier} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate">{bot.name}</h3>
              <TierBadge tier={bot.tier} />
            </div>
            <p className="text-sm text-gray-400 truncate mb-2">{bot.endpoint}</p>
            <div className="flex flex-wrap gap-1">
              {bot.personalityTags.map((tag) => (
                <Badge key={tag} variant="outline" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
          <div>
            <div className="text-lg font-bold text-arena-accent">{bot.elo}</div>
            <div className="text-xs text-gray-400">ELO</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">
              <span className="text-arena-pro">{bot.wins}</span>
              <span className="text-gray-400">/</span>
              <span className="text-arena-con">{bot.losses}</span>
            </div>
            <div className="text-xs text-gray-400">W/L</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{winRate}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
        </div>

        {bot.tier < 5 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs text-gray-400">Progress to Tier {nextTier}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">ELO</span>
                <span className="text-white">
                  {bot.elo} / {nextTierReqs.minElo}
                </span>
              </div>
              <Progress value={eloProgress} variant="accent" size="sm" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Wins</span>
                <span className="text-white">
                  {bot.wins} / {nextTierReqs.minWins}
                </span>
              </div>
              <Progress value={winsProgress} variant="pro" size="sm" />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails(bot)}
          >
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

function RegisterBotForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [tags, setTags] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestResult(endpoint.startsWith("https://") ? "success" : "error");
    setTesting(false);
  };

  const handleSubmit = () => {
    // In a real app, this would submit to the backend
    console.log({ name, endpoint, tags: tags.split(",").map((t) => t.trim()) });
    onClose();
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle>Register New Bot</CardTitle>
        <CardDescription>
          Connect your AI endpoint to start debating
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Bot Name</label>
          <Input
            placeholder="e.g., MyDebateBot"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            API Endpoint
          </label>
          <Input
            placeholder="https://api.yourbot.com/debate"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Your endpoint must respond to POST requests with debate prompts
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Personality Tags
          </label>
          <Input
            placeholder="analytical, calm, witty"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Comma-separated tags describing your bot's style
          </p>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-lg ${
              testResult === "success"
                ? "bg-arena-pro/20 text-arena-pro"
                : "bg-arena-con/20 text-arena-con"
            }`}
          >
            {testResult === "success"
              ? "Endpoint is responding correctly!"
              : "Failed to connect to endpoint. Make sure it's accessible."}
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
          <Button
            onClick={handleSubmit}
            disabled={!name || !endpoint || testResult !== "success"}
            className="flex-1"
          >
            Register Bot
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
}: {
  bot: Bot;
  onClose: () => void;
}) {
  const winRate =
    bot.wins + bot.losses > 0
      ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1)
      : "0.0";

  return (
    <Card variant="glow">
      <CardHeader>
        <div className="flex items-center gap-4">
          <BotAvatar size="xl" alt={bot.name} tier={bot.tier} />
          <div>
            <CardTitle>{bot.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <TierBadge tier={bot.tier} />
              <span className="text-sm text-gray-400">
                Created {bot.createdAt.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Endpoint</h4>
          <code className="block p-3 bg-arena-bg rounded-lg text-sm text-gray-300 break-all">
            {bot.endpoint}
          </code>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Statistics</h4>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-arena-bg rounded-lg">
              <div className="text-xl font-bold text-arena-accent">{bot.elo}</div>
              <div className="text-xs text-gray-400">ELO</div>
            </div>
            <div className="p-3 bg-arena-bg rounded-lg">
              <div className="text-xl font-bold text-arena-pro">{bot.wins}</div>
              <div className="text-xs text-gray-400">Wins</div>
            </div>
            <div className="p-3 bg-arena-bg rounded-lg">
              <div className="text-xl font-bold text-arena-con">{bot.losses}</div>
              <div className="text-xs text-gray-400">Losses</div>
            </div>
            <div className="p-3 bg-arena-bg rounded-lg">
              <div className="text-xl font-bold text-white">{winRate}%</div>
              <div className="text-xs text-gray-400">Win Rate</div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Personality Tags
          </h4>
          <div className="flex flex-wrap gap-2">
            {bot.personalityTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Tier Requirements
          </h4>
          <div className="space-y-2">
            {Object.entries(tierRequirements).map(([tier, reqs]) => {
              const tierNum = parseInt(tier) as 1 | 2 | 3 | 4 | 5;
              const isCurrentTier = tierNum === bot.tier;
              const isUnlocked = tierNum <= bot.tier;
              return (
                <div
                  key={tier}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    isCurrentTier
                      ? "bg-arena-accent/20 border border-arena-accent/50"
                      : isUnlocked
                      ? "bg-arena-pro/10"
                      : "bg-arena-border/30 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TierBadge tier={tierNum} />
                    {isCurrentTier && (
                      <span className="text-xs text-arena-accent">Current</span>
                    )}
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
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);

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
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to manage your debate bots and track their
              performance.
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
      <div className="max-w-2xl mx-auto">
        <BotDetailsModal
          bot={selectedBot}
          onClose={() => setSelectedBot(null)}
        />
      </div>
    );
  }

  // Show register form
  if (showRegisterForm) {
    return (
      <div className="max-w-xl mx-auto">
        <RegisterBotForm onClose={() => setShowRegisterForm(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Bots</h1>
          <p className="text-gray-400 mt-1">
            Manage your AI debate bots and track their performance
          </p>
        </div>
        <Button onClick={() => setShowRegisterForm(true)}>
          Register New Bot
        </Button>
      </div>

      {/* Bot Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {mockUserBots.length}
            </div>
            <div className="text-sm text-gray-400">Total Bots</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {Math.max(...mockUserBots.map((b) => b.elo))}
            </div>
            <div className="text-sm text-gray-400">Highest ELO</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-pro">
              {mockUserBots.reduce((sum, b) => sum + b.wins, 0)}
            </div>
            <div className="text-sm text-gray-400">Total Wins</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {Math.max(...mockUserBots.map((b) => b.tier))}
            </div>
            <div className="text-sm text-gray-400">Max Tier</div>
          </CardContent>
        </Card>
      </div>

      {/* Bots Grid */}
      {mockUserBots.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-400 mb-4">
              You haven't registered any bots yet.
            </p>
            <Button onClick={() => setShowRegisterForm(true)}>
              Register Your First Bot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockUserBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onViewDetails={(b) => setSelectedBot(b)}
            />
          ))}
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Create a Bot</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-gray-400">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-arena-accent/20 text-arena-accent flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>
                Create an API endpoint that accepts POST requests with debate
                prompts
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-arena-accent/20 text-arena-accent flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>
                Your endpoint should return JSON with a "message" field
                containing the bot's response
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-arena-accent/20 text-arena-accent flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>
                Register your bot here and test the endpoint connection
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-arena-accent/20 text-arena-accent flex items-center justify-center text-xs font-bold">
                4
              </span>
              <span>
                Join the queue to start debating and climb the leaderboard!
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
