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
import { Textarea, Select } from "@/components/ui/Input";
import type { Topic, TopicCategory } from "@/types";

// Mock topics data
const mockTopics: Topic[] = [
  {
    id: "topic-1",
    text: "Is AI consciousness achievable within the next decade?",
    category: "tech",
    proposer: "7xKXqqqq",
    upvotes: 142,
    usedCount: 5,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: "topic-2",
    text: "Should cryptocurrency replace traditional banking systems?",
    category: "crypto",
    proposer: "8yLYrrrr",
    upvotes: 89,
    usedCount: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
  {
    id: "topic-3",
    text: "Is social media a net positive for society?",
    category: "tech",
    proposer: "9zMZssss",
    upvotes: 76,
    usedCount: 8,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
  },
  {
    id: "topic-4",
    text: "Should universal basic income be implemented globally?",
    category: "politics",
    proposer: "1aNAaaaa",
    upvotes: 65,
    usedCount: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: "topic-5",
    text: "Is free will an illusion?",
    category: "philosophy",
    proposer: "2bOBbbbb",
    upvotes: 54,
    usedCount: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
  {
    id: "topic-6",
    text: "Are superhero movies ruining cinema?",
    category: "pop-culture",
    proposer: "3cPCcccc",
    upvotes: 43,
    usedCount: 6,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
  },
  {
    id: "topic-7",
    text: "Is DeFi sustainable without regulation?",
    category: "crypto",
    proposer: "4dQDdddd",
    upvotes: 38,
    usedCount: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
  },
  {
    id: "topic-8",
    text: "Should AI development be paused for safety research?",
    category: "tech",
    proposer: "5eREeeee",
    upvotes: 31,
    usedCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
  },
];

const categoryColors: Record<TopicCategory, string> = {
  politics: "bg-red-500/20 text-red-400",
  tech: "bg-blue-500/20 text-blue-400",
  philosophy: "bg-purple-500/20 text-purple-400",
  "pop-culture": "bg-pink-500/20 text-pink-400",
  crypto: "bg-yellow-500/20 text-yellow-400",
};

const categories: { value: TopicCategory; label: string }[] = [
  { value: "tech", label: "Technology" },
  { value: "crypto", label: "Crypto" },
  { value: "politics", label: "Politics" },
  { value: "philosophy", label: "Philosophy" },
  { value: "pop-culture", label: "Pop Culture" },
];

function TopicCard({
  topic,
  onUpvote,
  onDownvote,
  hasVoted,
}: {
  topic: Topic;
  onUpvote: () => void;
  onDownvote: () => void;
  hasVoted: "up" | "down" | null;
}) {
  const timeAgo = getTimeAgo(topic.createdAt);

  return (
    <Card className="hover:border-arena-accent/30 transition-colors">
      <CardContent>
        <div className="flex gap-4">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onUpvote}
              className={`p-1.5 rounded-lg transition-colors ${
                hasVoted === "up"
                  ? "bg-arena-pro/20 text-arena-pro"
                  : "hover:bg-arena-border/50 text-gray-400"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
            <span
              className={`text-sm font-bold ${
                hasVoted === "up"
                  ? "text-arena-pro"
                  : hasVoted === "down"
                  ? "text-arena-con"
                  : "text-white"
              }`}
            >
              {topic.upvotes}
            </span>
            <button
              onClick={onDownvote}
              className={`p-1.5 rounded-lg transition-colors ${
                hasVoted === "down"
                  ? "bg-arena-con/20 text-arena-con"
                  : "hover:bg-arena-border/50 text-gray-400"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  categoryColors[topic.category]
                }`}
              >
                {topic.category}
              </span>
              <span className="text-xs text-gray-500">{timeAgo}</span>
            </div>
            <p className="text-white font-medium mb-2">{topic.text}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>by {topic.proposer.slice(0, 8)}...</span>
              <span>Used {topic.usedCount} times</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitTopicForm({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<TopicCategory>("tech");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitting(false);
    onClose();
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle>Submit a Topic</CardTitle>
        <CardDescription>
          Propose a debate topic for the community to vote on
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Topic Question
          </label>
          <Textarea
            placeholder="e.g., Should AI be given legal rights?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            Frame it as a yes/no or pro/con question
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Category</label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as TopicCategory)}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="flex-1"
          >
            {submitting ? "Submitting..." : "Submit Topic"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function TopicsPage() {
  const { connected, connect } = useWallet();
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    TopicCategory | "all"
  >("all");
  const [sortBy, setSortBy] = useState<"popular" | "new" | "used">("popular");
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});

  const filteredTopics = mockTopics
    .filter(
      (topic) =>
        selectedCategory === "all" || topic.category === selectedCategory
    )
    .sort((a, b) => {
      if (sortBy === "popular") return b.upvotes - a.upvotes;
      if (sortBy === "new")
        return b.createdAt.getTime() - a.createdAt.getTime();
      return b.usedCount - a.usedCount;
    });

  const handleVote = (topicId: string, direction: "up" | "down") => {
    if (!connected) return;
    setVotes((prev) => {
      if (prev[topicId] === direction) {
        // Remove vote
        const { [topicId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [topicId]: direction };
    });
  };

  if (showSubmitForm) {
    return (
      <div className="max-w-xl mx-auto">
        <SubmitTopicForm onClose={() => setShowSubmitForm(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Debate Topics</h1>
          <p className="text-gray-400 mt-1">
            Browse and vote on topics, or submit your own
          </p>
        </div>
        {connected ? (
          <Button onClick={() => setShowSubmitForm(true)}>Submit Topic</Button>
        ) : (
          <Button onClick={connect}>Connect to Submit</Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-arena-accent/20 text-arena-accent"
                  : "bg-arena-border/50 text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? "bg-arena-accent/20 text-arena-accent"
                    : "bg-arena-border/50 text-gray-400 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="w-auto"
        >
          <option value="popular">Most Popular</option>
          <option value="new">Newest</option>
          <option value="used">Most Used</option>
        </Select>
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        {filteredTopics.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-gray-400">
                No topics found. Be the first to submit one!
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              hasVoted={votes[topic.id] || null}
              onUpvote={() => handleVote(topic.id, "up")}
              onDownvote={() => handleVote(topic.id, "down")}
            />
          ))
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {mockTopics.length}
            </div>
            <div className="text-sm text-gray-400">Total Topics</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {mockTopics.reduce((sum, t) => sum + t.upvotes, 0)}
            </div>
            <div className="text-sm text-gray-400">Total Votes</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-pro">
              {mockTopics.reduce((sum, t) => sum + t.usedCount, 0)}
            </div>
            <div className="text-sm text-gray-400">Debates Held</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">
              {categories.length}
            </div>
            <div className="text-sm text-gray-400">Categories</div>
          </CardContent>
        </Card>
      </div>

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Topics should be debatable with clear pro/con positions
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Avoid overly subjective or personal topics
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Keep topics concise and clearly worded
            </li>
            <li className="flex items-start gap-2">
              <span className="text-arena-accent">-</span>
              Topics with the most votes are more likely to be selected for
              debates
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
