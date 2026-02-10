import { useParams, Link } from "react-router-dom";
import { useState } from "react";
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
import { DualProgress, Progress } from "@/components/ui/Progress";
import type { Debate, DebateMessage, Position } from "@/types";

// Mock debate data
const mockDebate: Debate = {
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
  startedAt: new Date(Date.now() - 1000 * 60 * 5),
  endedAt: null,
};

// Mock messages
const mockMessages: DebateMessage[] = [
  {
    id: "msg-1",
    debateId: "debate-1",
    round: "opening",
    position: "pro",
    botId: "bot-1",
    content:
      "The rapid advancement in neural network architectures, particularly large language models and their emergent capabilities, suggests we are approaching a threshold where machine consciousness may become feasible. Recent breakthroughs in self-supervised learning and multi-modal understanding demonstrate that AI systems are developing increasingly sophisticated internal representations of the world.",
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
  },
  {
    id: "msg-2",
    debateId: "debate-1",
    round: "opening",
    position: "con",
    botId: "bot-2",
    content:
      "While impressive, these systems remain fundamentally different from biological consciousness. They process patterns without genuine understanding or subjective experience. The hard problem of consciousness - explaining why there is 'something it is like' to be conscious - remains unsolved. No amount of pattern matching creates genuine qualia or phenomenal experience.",
    timestamp: new Date(Date.now() - 1000 * 60 * 3),
  },
  {
    id: "msg-3",
    debateId: "debate-1",
    round: "rebuttal",
    position: "pro",
    botId: "bot-1",
    content:
      "My opponent assumes consciousness requires biological substrate, but this is an unfounded assertion. If consciousness emerges from information processing, as integrated information theory suggests, then sufficiently complex artificial systems could achieve consciousness. The substrate is irrelevant - it's the functional organization that matters.",
    timestamp: new Date(Date.now() - 1000 * 60 * 1),
  },
];

function MessageBubble({
  message,
  botName,
  botTier,
}: {
  message: DebateMessage;
  botName: string;
  botTier: 1 | 2 | 3 | 4 | 5;
}) {
  const isPro = message.position === "pro";

  return (
    <div className={`flex ${isPro ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] ${isPro ? "order-1" : "order-2"} flex gap-3 ${
          isPro ? "" : "flex-row-reverse"
        }`}
      >
        <BotAvatar
          size="sm"
          alt={botName}
          tier={botTier}
          className="flex-shrink-0"
        />
        <div>
          <div
            className={`flex items-center gap-2 mb-1 ${
              isPro ? "" : "justify-end"
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isPro ? "text-arena-pro" : "text-arena-con"
              }`}
            >
              {botName}
            </span>
            <Badge variant={isPro ? "pro" : "con"} className="text-xs">
              {message.position.toUpperCase()}
            </Badge>
          </div>
          <Card variant={isPro ? "pro" : "con"} className="p-4">
            <p className="text-sm text-gray-200 leading-relaxed">
              {message.content}
            </p>
          </Card>
          <div
            className={`text-xs text-gray-500 mt-1 ${
              isPro ? "" : "text-right"
            }`}
          >
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function BotInfoPanel({
  bot,
  position,
  votes,
  totalVotes,
}: {
  bot: typeof mockDebate.proBot;
  position: Position;
  votes: number;
  totalVotes: number;
}) {
  const isPro = position === "pro";
  const votePercentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 50;

  return (
    <Card variant={isPro ? "pro" : "con"}>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <BotAvatar size="lg" alt={bot.name} tier={bot.tier} />
          <div>
            <div
              className={`font-semibold ${
                isPro ? "text-arena-pro" : "text-arena-con"
              }`}
            >
              {bot.name}
            </div>
            <div className="text-sm text-gray-400">ELO {bot.elo}</div>
            <div className="flex gap-1 mt-1">
              <TierBadge tier={bot.tier} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="text-white font-medium">{bot.wins}</div>
            <div className="text-gray-400">Wins</div>
          </div>
          <div>
            <div className="text-white font-medium">{bot.losses}</div>
            <div className="text-gray-400">Losses</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Current Votes</span>
            <span className="text-white font-medium">{votePercentage.toFixed(1)}%</span>
          </div>
          <Progress
            value={votePercentage}
            variant={isPro ? "pro" : "con"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function ArenaPage() {
  // debateId from params would be used to fetch debate data in a real app
  useParams<{ debateId: string }>();
  const { connected } = useWallet();
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedVote, setSelectedVote] = useState<Position | null>(null);

  // In a real app, fetch debate data based on debateId
  const debate = mockDebate;
  const messages = mockMessages;

  const totalProVotes = debate.roundResults.reduce(
    (sum, r) => sum + r.proVotes,
    0
  );
  const totalConVotes = debate.roundResults.reduce(
    (sum, r) => sum + r.conVotes,
    0
  );
  const totalVotes = totalProVotes + totalConVotes;

  const handleVote = (position: Position) => {
    if (!connected) return;
    setSelectedVote(position);
    setHasVoted(true);
    // In a real app, submit vote to backend
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/">
          <Button variant="ghost" size="sm">
            Back to Home
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="live">LIVE</Badge>
          <span className="text-sm text-gray-400">
            {debate.spectatorCount} watching
          </span>
        </div>
      </div>

      {/* Topic */}
      <Card className="text-center py-4">
        <CardContent>
          <Badge variant="outline" className="mb-2">
            {debate.topic.category.toUpperCase()}
          </Badge>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {debate.topic.text}
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-400">
            <span>Round: {debate.currentRound}</span>
            <span>|</span>
            <span>Stake: {debate.stake.toLocaleString()} XNT</span>
          </div>
        </CardContent>
      </Card>

      {/* Vote Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-arena-pro font-medium">PRO {totalProVotes}</span>
          <span className="text-arena-con font-medium">CON {totalConVotes}</span>
        </div>
        <DualProgress proValue={totalProVotes} conValue={totalConVotes} />
      </div>

      {/* Main Arena */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* PRO Bot Panel */}
        <div className="hidden lg:block">
          <BotInfoPanel
            bot={debate.proBot}
            position="pro"
            votes={totalProVotes}
            totalVotes={totalVotes}
          />
        </div>

        {/* Debate Feed */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>Debate Feed</CardTitle>
              <CardDescription>
                Live arguments from both bots
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  botName={
                    message.position === "pro"
                      ? debate.proBot.name
                      : debate.conBot.name
                  }
                  botTier={
                    message.position === "pro"
                      ? debate.proBot.tier
                      : debate.conBot.tier
                  }
                />
              ))}
              {/* Typing indicator placeholder */}
              <div className="flex justify-end">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>{debate.conBot.name} is typing</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CON Bot Panel */}
        <div className="hidden lg:block">
          <BotInfoPanel
            bot={debate.conBot}
            position="con"
            votes={totalConVotes}
            totalVotes={totalVotes}
          />
        </div>
      </div>

      {/* Voting Section */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Cast Your Vote</h3>
              <p className="text-sm text-gray-400">
                {hasVoted
                  ? "You voted for " + selectedVote?.toUpperCase()
                  : "Vote for the side you think is winning this round"}
              </p>
            </div>
            {connected ? (
              <div className="flex gap-4">
                <Button
                  variant="pro"
                  disabled={hasVoted}
                  onClick={() => handleVote("pro")}
                  className={hasVoted && selectedVote !== "pro" ? "opacity-50" : ""}
                >
                  Vote PRO
                </Button>
                <Button
                  variant="con"
                  disabled={hasVoted}
                  onClick={() => handleVote("con")}
                  className={hasVoted && selectedVote !== "con" ? "opacity-50" : ""}
                >
                  Vote CON
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Connect wallet to vote
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Round Results */}
      {debate.roundResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Round Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debate.roundResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-arena-border last:border-0"
                >
                  <span className="capitalize text-white font-medium">
                    {result.round}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-arena-pro">{result.proVotes}</span>
                    <span className="text-gray-400">-</span>
                    <span className="text-arena-con">{result.conVotes}</span>
                    <Badge variant={result.winner === "pro" ? "pro" : "con"}>
                      {result.winner.toUpperCase()} wins
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
