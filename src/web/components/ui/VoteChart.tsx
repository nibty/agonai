interface RoundResult {
  round: string;
  proVotes: number;
  conVotes: number;
  winner: "pro" | "con" | null; // null = tie
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
  currentRound: _currentRound,
  isVoting,
  totalRounds = 7,
}: VoteChartProps) {
  const proWins = roundResults.filter((r) => r.winner === "pro").length;
  const conWins = roundResults.filter((r) => r.winner === "con").length;
  const completedRounds = roundResults.length;

  // Build data points for chart
  const dataPoints: {
    score: number;
    winner?: "pro" | "con" | null;
    isVoting?: boolean;
    proVotes?: number;
    conVotes?: number;
    roundNum?: number;
  }[] = [];
  let cumulative = 0;

  roundResults.forEach((result, i) => {
    if (result.winner === "pro") cumulative += 1;
    else if (result.winner === "con") cumulative -= 1;
    dataPoints.push({
      score: cumulative,
      winner: result.winner,
      proVotes: result.proVotes,
      conVotes: result.conVotes,
      roundNum: i + 1,
    });
  });

  // Add current voting round if active
  if (isVoting && currentVotes) {
    const total = currentVotes.pro + currentVotes.con;
    if (total > 0) {
      const proRatio = currentVotes.pro / total;
      const partialScore = (proRatio - 0.5) * 1.6; // -0.8 to +0.8
      dataPoints.push({
        score: cumulative + partialScore,
        isVoting: true,
        proVotes: currentVotes.pro,
        conVotes: currentVotes.con,
        roundNum: roundResults.length + 1,
      });
    } else {
      dataPoints.push({
        score: cumulative,
        isVoting: true,
        proVotes: 0,
        conVotes: 0,
        roundNum: roundResults.length + 1,
      });
    }
  }

  // Chart dimensions
  const chartHeight = 120;
  const edgePadding = 3; // Small padding to prevent dot clipping at edges
  const maxScore = Math.ceil(totalRounds / 2) + 0.5;

  // Calculate Y position
  const verticalPadding = 16; // Padding for top/bottom to keep dots visible
  const getY = (score: number) => {
    const normalized = score / maxScore;
    return chartHeight / 2 - normalized * (chartHeight / 2 - verticalPadding);
  };

  // Generate path for the line
  const generatePath = () => {
    if (dataPoints.length === 0) return "";

    const points = dataPoints.map((p, i) => {
      const x = edgePadding + (i / Math.max(totalRounds - 1, 1)) * (100 - edgePadding * 2);
      const y = getY(p.score);
      return { x, y };
    });

    const firstPoint = points[0];
    if (!firstPoint) return "";

    if (points.length === 1) {
      return `M ${firstPoint.x} ${firstPoint.y}`;
    }

    // Create smooth curve through points
    let path = `M ${firstPoint.x} ${firstPoint.y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (!prev || !curr) continue;
      const cpX = (prev.x + curr.x) / 2;
      path += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return path;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-arena-pro shadow-md shadow-arena-pro/40" />
          <span className="text-sm font-bold text-arena-pro">PRO</span>
          {proWins > 0 && (
            <span className="rounded-full bg-arena-pro/20 px-2 py-0.5 text-xs font-semibold text-arena-pro">
              {proWins}
            </span>
          )}
        </div>
        <span className="text-xs text-arena-text-dim">
          {completedRounds + (isVoting ? 1 : 0)} of {totalRounds}
        </span>
        <div className="flex items-center gap-2">
          {conWins > 0 && (
            <span className="rounded-full bg-arena-con/20 px-2 py-0.5 text-xs font-semibold text-arena-con">
              {conWins}
            </span>
          )}
          <span className="text-sm font-bold text-arena-con">CON</span>
          <div className="h-3 w-3 rounded-full bg-arena-con shadow-md shadow-arena-con/40" />
        </div>
      </div>

      {/* Chart */}
      <div
        className="relative overflow-hidden rounded-lg bg-arena-bg/50"
        style={{ height: chartHeight }}
      >
        {/* Background zones */}
        <div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-arena-pro/10 to-transparent"
          style={{ height: "50%" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-arena-con/10 to-transparent"
          style={{ height: "50%" }}
        />

        {/* Center line */}
        <div
          className="absolute inset-x-0 border-t border-dashed border-arena-border/40"
          style={{ top: "50%" }}
        />

        {/* Grid lines for future rounds */}
        {Array.from({ length: totalRounds }).map((_, i) => {
          const x = edgePadding + (i / Math.max(totalRounds - 1, 1)) * (100 - edgePadding * 2);
          return (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-arena-border/20"
              style={{ left: `${x}%` }}
            />
          );
        })}

        {/* SVG for line */}
        {dataPoints.length > 0 && (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 100 ${chartHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="voteLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--arena-accent))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--arena-accent))" stopOpacity="1" />
              </linearGradient>
              <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d={generatePath()}
              fill="none"
              stroke="url(#voteLineGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
            />
          </svg>
        )}

        {/* Data points */}
        {dataPoints.map((point, i) => {
          const x = edgePadding + (i / Math.max(totalRounds - 1, 1)) * (100 - edgePadding * 2);
          const y = getY(point.score);
          const isRightSide = x > 50;

          return (
            <div
              key={i}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: y }}
            >
              {/* Tooltip */}
              {(point.proVotes !== undefined || point.conVotes !== undefined) && (
                <div
                  className={`pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded bg-arena-card px-2 py-1 text-[10px] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${
                    isRightSide ? "right-1/2 translate-x-1/2" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  <div className="font-medium text-arena-text-muted">R{point.roundNum}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-arena-pro">{point.proVotes}</span>
                    <span className="text-arena-text-dim">-</span>
                    <span className="text-arena-con">{point.conVotes}</span>
                  </div>
                </div>
              )}
              {/* Dot */}
              {point.isVoting ? (
                <div className="relative">
                  <div className="absolute inset-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-arena-voting/40" />
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-arena-card bg-arena-voting shadow-md shadow-arena-voting/50" />
                </div>
              ) : point.winner === "pro" ? (
                <div className="h-3 w-3 rounded-full border border-arena-pro/30 bg-arena-pro shadow-md shadow-arena-pro/50" />
              ) : point.winner === "con" ? (
                <div className="h-3 w-3 rounded-full border border-arena-con/30 bg-arena-con shadow-md shadow-arena-con/50" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-arena-text-muted/60" />
              )}
            </div>
          );
        })}

        {/* Empty state placeholder dots */}
        {dataPoints.length === 0 &&
          Array.from({ length: totalRounds }).map((_, i) => {
            const x = edgePadding + (i / Math.max(totalRounds - 1, 1)) * (100 - edgePadding * 2);
            return (
              <div
                key={i}
                className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-arena-border/30"
                style={{ left: `${x}%` }}
              />
            );
          })}
      </div>

      {/* Current voting info */}
      {isVoting && currentVotes && (currentVotes.pro > 0 || currentVotes.con > 0) && (
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <span className="text-arena-pro">{currentVotes.pro} votes</span>
          <span className="text-arena-text-dim">vs</span>
          <span className="text-arena-con">{currentVotes.con} votes</span>
        </div>
      )}
    </div>
  );
}
