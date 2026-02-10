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
  const chartHeight = 80;
  const maxScore = Math.ceil(totalRounds / 2) + 1;

  // Calculate Y position (0 = center, positive = up, negative = down)
  const getY = (score: number) => {
    const normalized = score / maxScore;
    return chartHeight / 2 - normalized * (chartHeight / 2 - 8);
  };

  const proWins = roundResults.filter((r) => r.winner === "pro").length;
  const conWins = roundResults.filter((r) => r.winner === "con").length;

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-arena-pro">PRO {proWins > 0 && `+${proWins}`}</span>
        <span className="text-gray-500">Round {roundResults.length + (isVoting ? 1 : 0)} / {totalRounds}</span>
        <span className="font-medium text-arena-con">CON {conWins > 0 && `+${conWins}`}</span>
      </div>

      {/* Chart */}
      <div className="relative rounded border border-arena-border/30 bg-arena-bg/50" style={{ height: chartHeight }}>
        {/* Pro zone (top half) */}
        <div
          className="absolute inset-x-0 top-0 bg-arena-pro/10"
          style={{ height: chartHeight / 2 }}
        />

        {/* Con zone (bottom half) */}
        <div
          className="absolute inset-x-0 bottom-0 bg-arena-con/10"
          style={{ height: chartHeight / 2 }}
        />

        {/* Center line */}
        <div
          className="absolute inset-x-0 border-t border-dashed border-gray-600"
          style={{ top: chartHeight / 2 }}
        />

        {/* Line chart */}
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${chartHeight}`}
        >
          {/* Draw connecting lines */}
          {scores.length > 1 &&
            scores.slice(1).map((point, i) => {
              const prev = scores[i];
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
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
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
              className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${
                point.winner === "pro"
                  ? "bg-arena-pro"
                  : point.winner === "con"
                    ? "bg-arena-con"
                    : isCurrentVoting
                      ? "animate-pulse bg-yellow-400"
                      : "bg-gray-500"
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
