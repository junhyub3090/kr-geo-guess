import type { CSSProperties } from "react";

type RoundProgressTrackProps = {
  roundCount: number;
  currentRoundNumber: number;
  completedScores: ReadonlyMap<number, number>;
};

export function RoundProgressTrack({
  roundCount,
  currentRoundNumber,
  completedScores,
}: RoundProgressTrackProps) {
  const safeRoundCount = Math.max(1, roundCount);
  const currentRound = Math.min(
    safeRoundCount,
    Math.max(1, currentRoundNumber),
  );
  const rounds = Array.from({ length: safeRoundCount }, (_, index) => index + 1);
  const completedCount = rounds.filter((roundNumber) =>
    completedScores.has(roundNumber),
  ).length;
  const totalScore = rounds.reduce(
    (score, roundNumber) => score + (completedScores.get(roundNumber) ?? 0),
    0,
  );
  const progressRatio =
    safeRoundCount > 1
      ? completedCount / (safeRoundCount - 1)
      : completedCount > 0
        ? 1
        : 0;
  const progressPercent = `${Math.min(1, progressRatio) * 100}%`;

  return (
    <section
      className="round-progress-track"
      aria-label="라운드 진행 상황"
      style={{ "--round-progress": progressPercent } as CSSProperties}
    >
      <div className="round-progress-copy">
        <strong>{`라운드 ${currentRound} / ${safeRoundCount}`}</strong>
        <span>
          {completedCount > 0
            ? `완료 ${completedCount}개 · ${totalScore.toLocaleString("ko-KR")}점`
            : "이번 라운드 진행 중"}
        </span>
      </div>
      <div className="round-progress-rail" aria-hidden="true">
        <span />
      </div>
      <ol className="round-progress-dots" aria-hidden="true">
        {rounds.map((roundNumber) => {
          const isCompleted = completedScores.has(roundNumber);
          const isCurrent = !isCompleted && roundNumber === currentRound;

          return (
            <li
              className={[
                "round-progress-dot",
                isCompleted ? "completed" : "",
                isCurrent ? "current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={roundNumber}
            />
          );
        })}
      </ol>
    </section>
  );
}
