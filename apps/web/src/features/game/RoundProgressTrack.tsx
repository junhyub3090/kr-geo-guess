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
  const rounds = Array.from({ length: roundCount }, (_, index) => index + 1);

  return (
    <nav className="round-progress-track" aria-label="라운드 진행 상황">
      <ol>
        {rounds.map((roundNumber) => {
          const completedScore = completedScores.get(roundNumber);
          const isCompleted = typeof completedScore === "number";
          const isCurrent = !isCompleted && roundNumber === currentRoundNumber;

          return (
            <li
              aria-current={isCurrent ? "step" : undefined}
              aria-label={getRoundProgressLabel(
                roundNumber,
                isCompleted,
                isCurrent,
                completedScore,
              )}
              className={[
                "round-progress-step",
                isCompleted ? "completed" : "",
                isCurrent ? "current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={roundNumber}
            >
              <span>R{roundNumber}</span>
              <strong>
                {isCompleted
                  ? `${completedScore.toLocaleString("ko-KR")}점`
                  : isCurrent
                    ? "진행"
                    : "대기"}
              </strong>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function getRoundProgressLabel(
  roundNumber: number,
  isCompleted: boolean,
  isCurrent: boolean,
  completedScore: number | undefined,
) {
  if (isCompleted) {
    return `라운드 ${roundNumber} 완료, ${completedScore?.toLocaleString("ko-KR")}점`;
  }

  if (isCurrent) {
    return `라운드 ${roundNumber} 진행 중`;
  }

  return `라운드 ${roundNumber} 대기`;
}
