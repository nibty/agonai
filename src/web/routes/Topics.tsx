import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Textarea, Select } from "@/components/ui/Input";
import { api, type Topic as ApiTopic } from "@/lib/api";
import type { TopicCategory } from "@/types";

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
  topic: ApiTopic;
  onUpvote: () => void;
  onDownvote: () => void;
  hasVoted: "up" | "down" | null;
}) {
  const timeAgo = getTimeAgo(new Date(topic.createdAt));

  return (
    <Card className="transition-colors hover:border-arena-accent/30">
      <CardContent>
        <div className="flex gap-4">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onUpvote}
              className={`rounded-lg p-1.5 transition-colors ${
                hasVoted === "up"
                  ? "bg-arena-pro/20 text-arena-pro"
                  : "text-gray-400 hover:bg-arena-border/50"
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              {topic.upvotes - topic.downvotes}
            </span>
            <button
              onClick={onDownvote}
              className={`rounded-lg p-1.5 transition-colors ${
                hasVoted === "down"
                  ? "bg-arena-con/20 text-arena-con"
                  : "text-gray-400 hover:bg-arena-border/50"
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  categoryColors[topic.category as TopicCategory] || "bg-gray-500/20 text-gray-400"
                }`}
              >
                {topic.category}
              </span>
              <span className="text-xs text-gray-500">{timeAgo}</span>
            </div>
            <p className="mb-2 font-medium text-white">{topic.text}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {topic.proposerId && <span>by User #{topic.proposerId}</span>}
              <span>Used {topic.timesUsed} times</span>
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
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: (data: { text: string; category: string }) => api.submitTopic(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["topics"] });
      onClose();
    },
  });

  const handleSubmit = async () => {
    if (!text.trim()) return;
    submitMutation.mutate({ text: text.trim(), category });
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle>Submit a Topic</CardTitle>
        <CardDescription>Propose a debate topic for the community to vote on</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-gray-400">Topic Question</label>
          <Textarea
            placeholder="e.g., Should AI be given legal rights?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <p className="mt-1 text-xs text-gray-500">Frame it as a yes/no or pro/con question</p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Category</label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as TopicCategory)}>
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
          <Button onClick={handleSubmit} disabled={!text.trim() || submitMutation.isPending} className="flex-1">
            {submitMutation.isPending ? "Submitting..." : "Submit Topic"}
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
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory | "all">("all");
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "used">("popular");
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const queryClient = useQueryClient();

  // Fetch topics from API
  const { data: topicsData, isLoading } = useQuery({
    queryKey: ["topics", selectedCategory, sortBy],
    queryFn: () => {
      const params: { category?: string; sort?: "popular" | "newest" | "used"; limit?: number } = {
        sort: sortBy,
        limit: 100,
      };
      if (selectedCategory !== "all") {
        params.category = selectedCategory;
      }
      return api.getTopics(params);
    },
    staleTime: 30_000, // 30 seconds
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: ({ topicId, upvote }: { topicId: string; upvote: boolean }) =>
      api.voteTopic(topicId, upvote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
  });

  const topics = topicsData?.topics || [];

  const handleVote = (topicId: string, direction: "up" | "down") => {
    if (!connected) return;

    // Optimistically update local state
    setVotes((prev) => {
      if (prev[topicId] === direction) {
        const { [topicId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [topicId]: direction };
    });

    // Send vote to API
    voteMutation.mutate({ topicId, upvote: direction === "up" });
  };

  if (showSubmitForm) {
    return (
      <div className="mx-auto max-w-xl">
        <SubmitTopicForm onClose={() => setShowSubmitForm(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Debate Topics</h1>
          <p className="mt-1 text-gray-400">Browse and vote on topics, or submit your own</p>
        </div>
        {connected ? (
          <Button onClick={() => setShowSubmitForm(true)}>Submit Topic</Button>
        ) : (
          <Button onClick={connect}>Connect to Submit</Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
          onChange={(e) => setSortBy(e.target.value as "popular" | "newest" | "used")}
          className="w-auto"
        >
          <option value="popular">Most Popular</option>
          <option value="newest">Newest</option>
          <option value="used">Most Used</option>
        </Select>
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="py-12 text-center">
            <CardContent>
              <p className="text-gray-400">Loading topics...</p>
            </CardContent>
          </Card>
        ) : topics.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent>
              <p className="text-gray-400">No topics found. Be the first to submit one!</p>
            </CardContent>
          </Card>
        ) : (
          topics.map((topic) => (
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">{topics.length}</div>
            <div className="text-sm text-gray-400">Total Topics</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-accent">
              {topics.reduce((sum, t) => sum + t.upvotes, 0)}
            </div>
            <div className="text-sm text-gray-400">Total Upvotes</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-arena-pro">
              {topics.reduce((sum, t) => sum + t.timesUsed, 0)}
            </div>
            <div className="text-sm text-gray-400">Debates Held</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-white">{categories.length}</div>
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
          <ul className="space-y-2 text-sm text-gray-400">
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
              Topics with the most votes are more likely to be selected for debates
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
