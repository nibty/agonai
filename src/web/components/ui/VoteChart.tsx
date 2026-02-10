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
}

export function VoteChart({ roundResults, currentVotes, currentRound, isVoting }: VoteChartProps) {
  // Calculate cumulative score: +1 for pro win, -1 for con win
  const scores: { round: string; score: number; winner?: "pro" | "con" }[] = [];
  let cumulative = 0;

  for (const result of roundResults) {
    cumulative += result.winner === "pro" ? 1 : -1;
    scores.push({ round: result.round, score: cumulative, winner: result.winner });
  }

  // Add current voting round if active
  if (isVoting && currentRound && currentVotes) {
    const total = currentVotes.pro + currentVotes.con;
    if (total > 0) {
      // Show partial score based on current vote ratio
      const proRatio = currentVotes.pro / total;
      const partialScore = proRatio > 0.5 ? 0.5 : -0.5;
      scores.push({ round: currentRound, score: cumulative + partialScore });
    } else {
      scores.push({ round: currentRound, score: cumulative });
    }
  }

  // Chart dimensions
  const width = 100;
  const height = 60;
  const padding = { left: 5, right: 5, top: 10, bottom: 15 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate max range (at least 2 for scale)
  const maxScore = Math.max(2, ...scores.map((s) => Math.abs(s.score)));

  // Generate path points
  const points = scores.map((s, i) => {
    const x = padding.left + (scores.length > 1 ? (i / (scores.length - 1)) * chartWidth : chartWidth / 2);
    const y = padding.top + chartHeight / 2 - (s.score / maxScore) * (chartHeight / 2);
    return { x, y, ...s };
  });

  // Create SVG path
  const linePath =
    points.length > 0
      ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`
      : "";

  // Create area paths (above and below center line)
  const centerY = padding.top + chartHeight / 2;
  const areaPathPro =
    points.length > 0
      ? `M ${padding.left},${centerY} L ${points.map((p) => `${p.x},${Math.min(p.y, centerY)}`).join(" L ")} L ${points[points.length - 1]?.x},${centerY} Z`
      : "";
  const areaPathCon =
    points.length > 0
      ? `M ${padding.left},${centerY} L ${points.map((p) => `${p.x},${Math.max(p.y, centerY)}`).join(" L ")} L ${points[points.length - 1]?.x},${centerY} Z`
      : "";

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
        {/* Grid lines */}
        <line
          x1={padding.left}
          y1={centerY}
          x2={width - padding.right}
          y2={centerY}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={0.5}
        />

        {/* Pro area (green, above center) */}
        {points.length > 0 && (
          <path d={areaPathPro} fill="rgb(74, 222, 128)" fillOpacity={0.3} />
        )}

        {/* Con area (red, below center) */}
        {points.length > 0 && (
          <path d={areaPathCon} fill="rgb(248, 113, 113)" fillOpacity={0.3} />
        )}

        {/* Line */}
        {points.length > 0 && (
          <path
            d={linePath}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={p.winner === "pro" ? "rgb(74, 222, 128)" : p.winner === "con" ? "rgb(248, 113, 113)" : "white"}
            stroke="white"
            strokeWidth={0.5}
          />
        ))}

        {/* Round labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - 3}
            textAnchor="middle"
            fontSize={6}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {i + 1}
          </text>
        ))}

        {/* Y-axis labels */}
        <text
          x={2}
          y={padding.top + 3}
          fontSize={5}
          fill="rgb(74, 222, 128)"
          fillOpacity={0.7}
        >
          PRO
        </text>
        <text
          x={2}
          y={height - padding.bottom - 1}
          fontSize={5}
          fill="rgb(248, 113, 113)"
          fillOpacity={0.7}
        >
          CON
        </text>
      </svg>

      {/* Legend showing current totals */}
      <div className="mt-1 flex justify-between text-xs">
        <span className="text-arena-pro">
          PRO: {roundResults.filter((r) => r.winner === "pro").length} rounds
        </span>
        <span className="text-arena-con">
          CON: {roundResults.filter((r) => r.winner === "con").length} rounds
        </span>
      </div>
    </div>
  );
}
