interface DebateProgressProps {
  currentRoundIndex: number;
  totalRounds: number;
  roundStatus: "bot_responding" | "voting" | "completed" | string;
  debateStatus: "pending" | "in_progress" | "completed" | string;
  votingTimeLeft?: number;
  votingDuration?: number;
}

const phases = ["bot_responding", "voting", "completed"] as const;

export function DebateProgress({
  currentRoundIndex,
  totalRounds,
  roundStatus,
  debateStatus,
  votingTimeLeft = 0,
  votingDuration = 0,
}: DebateProgressProps) {
  // Calculate overall debate progress
  const completedRounds = roundStatus === "completed" ? currentRoundIndex + 1 : currentRoundIndex;
  const debateProgress = debateStatus === "completed"
    ? 100
    : (completedRounds / totalRounds) * 100;

  // Phase within current round
  const currentPhaseIndex = phases.indexOf(roundStatus as typeof phases[number]);

  // For voting phase, show time-based progress
  const votingProgress = votingDuration > 0 ? (votingTimeLeft / votingDuration) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Overall Debate Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-arena-text">Debate Progress</span>
          <span className="text-arena-text-muted">
            {debateStatus === "completed" ? "Complete" : `Round ${currentRoundIndex + 1} of ${totalRounds}`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-arena-bg/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-arena-accent to-arena-accent-light transition-all duration-500"
            style={{ width: `${debateProgress}%` }}
          />
        </div>
        {/* Round markers */}
        <div className="mt-1 flex justify-between px-0.5">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i < completedRounds
                  ? "bg-arena-accent"
                  : i === currentRoundIndex && debateStatus !== "completed"
                    ? "bg-arena-voting animate-pulse"
                    : "bg-arena-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Current Round Phase Progress (only show during active debate) */}
      {debateStatus === "in_progress" && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-arena-text">Round {currentRoundIndex + 1} Phase</span>
            <span className="text-arena-text-muted">
              {roundStatus === "bot_responding" && "Bots Debating"}
              {roundStatus === "voting" && `Voting (${votingTimeLeft}s)`}
              {roundStatus === "completed" && "Complete"}
            </span>
          </div>

          {/* Phase segments */}
          <div className="flex gap-1">
            {/* Bot Responding Phase */}
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-l-full bg-arena-bg/80">
                <div
                  className={`h-full transition-all duration-300 ${
                    roundStatus === "bot_responding"
                      ? "animate-pulse bg-arena-voting"
                      : currentPhaseIndex > 0
                        ? "bg-arena-accent"
                        : "bg-transparent"
                  }`}
                  style={{ width: currentPhaseIndex >= 0 ? "100%" : "0%" }}
                />
              </div>
              <div className="mt-1 text-center text-[10px] text-arena-text-dim">Debate</div>
            </div>

            {/* Voting Phase */}
            <div className="flex-1">
              <div className="h-2 overflow-hidden bg-arena-bg/80">
                <div
                  className={`h-full transition-all duration-300 ${
                    roundStatus === "voting"
                      ? "bg-arena-accent"
                      : currentPhaseIndex > 1
                        ? "bg-arena-accent"
                        : "bg-transparent"
                  }`}
                  style={{
                    width: roundStatus === "voting"
                      ? `${votingProgress}%`
                      : currentPhaseIndex > 1
                        ? "100%"
                        : "0%"
                  }}
                />
              </div>
              <div className="mt-1 text-center text-[10px] text-arena-text-dim">Vote</div>
            </div>

            {/* Complete Phase */}
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-r-full bg-arena-bg/80">
                <div
                  className={`h-full transition-all duration-300 ${
                    roundStatus === "completed" ? "bg-arena-pro" : "bg-transparent"
                  }`}
                  style={{ width: roundStatus === "completed" ? "100%" : "0%" }}
                />
              </div>
              <div className="mt-1 text-center text-[10px] text-arena-text-dim">Done</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
