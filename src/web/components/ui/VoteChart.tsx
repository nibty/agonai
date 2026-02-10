interface RoundResult {
  round: string;
  proVotes: number;
  conVotes: number;
  winner: "pro" | "con";
}

interface VoteChartProps {
  roundResults: RoundResult[];
  currentVotes?: { pro: number; con: number } | undefined;
  currentRound?: string | undefined;
  isVoting?: boolean | undefined;
  totalRounds?: number | undefined;
}

export function VoteChart({
  roundResults,
  currentVotes,
  currentRound,
  isVoting,
  totalRounds = 7,
}: VoteChartProps) {
  // Calculate cumulative score: +1 for pro win, -1 for con win
  const scores: { round: string; score: number; winner?: "pro" | "con" }[] = [];
  let cumulative = 0;

  // Start with 0
  scores.push({ round: "Start", score: 0 });

  for (const result of roundResults) {
    cumulative += result.winner === "pro" ? 1 : -1;
    scores.push({ round: result.round, score: cumulative, winner: result.winner });
  }

  // Add current voting round if active
  if (isVoting && currentRound && currentVotes) {
    const total = currentVotes.pro + currentVotes.con;
    if (total > 0) {
      const proRatio = currentVotes.pro / total;
      const partialScore = (proRatio - 0.5) * 2 * 0.8; // -0.8 to +0.8 based on vote ratio
      scores.push({ round: currentRound, score: cumulative + partialScore });
    }
  }

  // Chart config
  const chartHeight = 100;
  const maxScore = Math.ceil(totalRounds / 2) + 1;

  // Calculate Y position (0 = center, positive = up, negative = down)
  const getY = (score: number) => {
    const normalized = score / maxScore;
    return chartHeight / 2 - normalized * (chartHeight / 2 - 12);
  };

  const proWins = roundResults.filter((r) => r.winner === "pro").length;
  const conWins = roundResults.filter((r) => r.winner === "con").length;

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-arena-pro">
          <span className="inline-block h-2 w-2 rounded-full bg-arena-pro"></span>
          PRO {proWins > 0 && <span className="rounded bg-arena-pro/20 px-1">{`+${proWins}`}</span>}
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-gray-400">
          Round {roundResults.length + (isVoting ? 1 : 0)} / {totalRounds}
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-arena-con">
          CON {conWins > 0 && <span className="rounded bg-arena-con/20 px-1">{`+${conWins}`}</span>}
          <span className="inline-block h-2 w-2 rounded-full bg-arena-con"></span>
        </span>
      </div>

      {/* Chart */}
      <div className="relative rounded-xl border border-arena-border/30" style={{ height: chartHeight, padding: "0 12px" }}>
        {/* Pro zone (top half) with gradient */}
        <div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-arena-pro/20 to-arena-pro/5"
          style={{ height: chartHeight / 2 }}
        />

        {/* Con zone (bottom half) with gradient */}
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-arena-con/20 to-arena-con/5"
          style={{ height: chartHeight / 2 }}
        />

        {/* Center line */}
        <div
          className="absolute inset-x-0 border-t border-white/20"
          style={{ top: chartHeight / 2 }}
        />

        {/* Grid lines */}
        <div className="absolute inset-x-0 border-t border-white/5" style={{ top: chartHeight / 4 }} />
        <div className="absolute inset-x-0 border-t border-white/5" style={{ top: (chartHeight * 3) / 4 }} />

        {/* Line chart */}
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${chartHeight}`}
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Draw connecting lines */}
          {scores.length > 1 &&
            scores.slice(1).map((point, i) => {
              const prev = scores[i]!;
              const x1 = (i / (scores.length - 1)) * 100;
              const x2 = ((i + 1) / (scores.length - 1)) * 100;
              const y1 = getY(prev.score);
              const y2 = getY(point.score);

              return (
                <line
                  key={`line-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="url(#lineGradient)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
              );
            })}
        </svg>

        {/* Points (as positioned divs for better rendering) */}
        {scores.map((point, i) => {
          const x = scores.length > 1 ? (i / (scores.length - 1)) * 100 : 50;
          const y = getY(point.score);
          const isCurrentVoting = i === scores.length - 1 && isVoting;

          return (
            <div
              key={`point-${i}-${point.round}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                point.winner === "pro"
                  ? "h-4 w-4 border-white bg-arena-pro shadow-lg shadow-arena-pro/50"
                  : point.winner === "con"
                    ? "h-4 w-4 border-white bg-arena-con shadow-lg shadow-arena-con/50"
                    : isCurrentVoting
                      ? "h-5 w-5 animate-pulse border-yellow-300 bg-yellow-400 shadow-lg shadow-yellow-400/50"
                      : "h-3 w-3 border-white/50 bg-arena-accent"
              }`}
              style={{
                left: `${x}%`,
                top: y,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
