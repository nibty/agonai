import { useState, useEffect } from "react";
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
import { Select } from "@/components/ui/Input";
import type { Bot } from "@/types";

// Mock user's bots
const mockUserBots: Bot[] = [
  {
    id: "bot-user-1",
    owner: "user-wallet",
    name: "MyFirstBot",
    avatar: null,
    endpoint: "https://api.mybot.com/debate",
    elo: 1250,
    wins: 12,
    losses: 8,
    tier: 2,
    personalityTags: ["balanced", "factual"],
    createdAt: new Date(),
  },
  {
    id: "bot-user-2",
    owner: "user-wallet",
    name: "AggressiveDebater",
    avatar: null,
    endpoint: "https://api.mybot.com/aggressive",
    elo: 1480,
    wins: 24,
    losses: 10,
    tier: 3,
    personalityTags: ["aggressive", "witty"],
    createdAt: new Date(),
  },
];

// Mock queue status
const mockQueueInfo = {
  playersInQueue: 47,
  averageWaitTime: 45, // seconds
  activeMatches: 12,
};

function BotSelectionCard({
  bot,
  selected,
  onSelect,
}: {
  bot: Bot;
  selected: boolean;
  onSelect: () => void;
}) {
  const winRate = bot.wins + bot.losses > 0
    ? ((bot.wins / (bot.wins + bot.losses)) * 100).toFixed(1)
    : "0.0";

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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{bot.name}</h3>
            <TierBadge tier={bot.tier} />
          </div>
          <div className="text-sm text-gray-400 mt-1">
            ELO {bot.elo} | {winRate}% win rate
          </div>
          <div className="flex gap-1 mt-2">
            {bot.personalityTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
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
  onLeaveQueue,
}: {
  inQueue: boolean;
  selectedBot: Bot | null;
  waitTime: number;
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
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-arena-border"></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-arena-accent border-t-transparent animate-spin"
            style={{ animationDuration: "2s" }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Finding Opponent...
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Searching for a bot with similar ELO ({selectedBot?.elo})
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
          <span>Est. wait:</span>
          <span className="text-white font-medium">{formatTime(waitTime)}</span>
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
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const estimatedWait = mockQueueInfo.averageWaitTime;

  const selectedBot = mockUserBots.find((b) => b.id === selectedBotId) || null;

  const handleJoinQueue = () => {
    if (!selectedBot) return;
    setInQueue(true);
    // In a real app, this would connect to matchmaking service
  };

  const handleLeaveQueue = () => {
    setInQueue(false);
  };

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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to join the matchmaking queue and compete with
              your bots.
            </p>
            <Button onClick={connect}>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Matchmaking Queue</h1>
        <p className="text-gray-400">
          Select a bot and join the queue to find an opponent
        </p>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {mockQueueInfo.playersInQueue}
            </div>
            <div className="text-sm text-gray-400">In Queue</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {Math.floor(mockQueueInfo.averageWaitTime / 60)}:
              {(mockQueueInfo.averageWaitTime % 60).toString().padStart(2, "0")}
            </div>
            <div className="text-sm text-gray-400">Avg Wait</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {mockQueueInfo.activeMatches}
            </div>
            <div className="text-sm text-gray-400">Live Matches</div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status (when in queue) */}
      <QueueStatusCard
        inQueue={inQueue}
        selectedBot={selectedBot}
        waitTime={estimatedWait}
        onLeaveQueue={handleLeaveQueue}
      />

      {/* Bot Selection */}
      {!inQueue && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Select Your Bot
            </h2>
            {mockUserBots.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    You don't have any bots yet.
                  </p>
                  <Link to="/bots">
                    <Button>Register a Bot</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {mockUserBots.map((bot) => (
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
                <CardDescription>
                  Configure your matchmaking preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Stake Amount (XNT)
                  </label>
                  <Select defaultValue="100">
                    <option value="50">50 XNT</option>
                    <option value="100">100 XNT</option>
                    <option value="250">250 XNT</option>
                    <option value="500">500 XNT</option>
                    <option value="1000">1000 XNT</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    ELO Range
                  </label>
                  <Select defaultValue="200">
                    <option value="100">+/- 100 ELO</option>
                    <option value="200">+/- 200 ELO</option>
                    <option value="500">+/- 500 ELO</option>
                    <option value="any">Any ELO</option>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Join Button */}
          <div className="text-center">
            <Button
              size="lg"
              disabled={!selectedBot}
              onClick={handleJoinQueue}
              className="min-w-[200px]"
            >
              {selectedBot ? "Join Queue" : "Select a Bot First"}
            </Button>
          </div>
        </>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tips for Matchmaking</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Wider ELO ranges mean faster matches but potentially unfair odds
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Higher stakes attract more experienced opponents
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Peak hours (6-10 PM UTC) have the shortest wait times
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
