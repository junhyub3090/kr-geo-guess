import {
  Clock3,
  Flag,
  Home,
  Map,
  RotateCcw,
  Send,
  Trophy,
} from "lucide-react";
import { formatDistance, getGameMap } from "@kr-geo-guess/shared";
import type { ReactNode } from "react";
import { KakaoRoadviewPanel } from "../provider/KakaoRoadviewPanel";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import { useApiSoloGame } from "./useApiSoloGame";
import type { ApiMatch } from "../api/gameApi";

export function GameScreen({
  initialMatch,
  onExit,
}: {
  initialMatch: ApiMatch;
  onExit: () => void;
}) {
  const game = useApiSoloGame(initialMatch);
  const mapDefinition = getGameMap(game.match.mapId);
  const isReveal = game.match.phase === "reveal";
  const isFinished = game.match.phase === "finished";
  const roundNumber = game.match.currentRound?.roundNumber ?? game.match.roundCount;
  const timerLabel = isReveal || isFinished
    ? "공개 중"
    : formatClock(game.remainingSeconds);

  if (isFinished) {
    return (
      <main className="app-shell final-shell">
        <header className="topbar">
          <div className="brand-block">
            <h1>어디길</h1>
          </div>
          <div className="round-metrics" aria-label="최종 결과 정보">
            <Metric icon={<Map size={16} />} label={game.match.mapName} />
            <Metric icon={<Flag size={16} />} label={`${game.match.roundCount}라운드 완료`} />
            <Metric icon={<Trophy size={16} />} label={game.match.totalScore.toLocaleString("ko-KR")} />
            <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
              <Home size={16} />
            </button>
          </div>
        </header>
        <FinalResultsPanel
          totalScore={game.match.totalScore}
          results={game.match.results}
          onRestart={onExit}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>어디길</h1>
        </div>
        <div className="round-metrics" aria-label="라운드 정보">
          <Metric icon={<Map size={16} />} label={game.match.mapName} />
          <Metric icon={<Flag size={16} />} label={`Round ${roundNumber} / ${game.match.roundCount}`} />
          <Metric icon={<Clock3 size={16} />} label={timerLabel} tone="timer" />
          <Metric icon={<Trophy size={16} />} label={game.match.totalScore.toLocaleString("ko-KR")} />
          <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
            <Home size={16} />
          </button>
        </div>
      </header>

      <section className="game-layout">
        <KakaoRoadviewPanel
          target={game.currentTargetForViewer}
        />

        <aside className="side-panel" aria-label="추측과 방 상태">
          <section className="panel-section map-panel">
            <div className="section-heading">
              <div>
                <h2>{isReveal ? "정답 공개" : "우리나라 지도에 핀 찍기"}</h2>
                <p>
                  {isReveal
                    ? `${mapDefinition.name} · ${game.currentResult?.target.region1 ?? ""} ${game.currentResult?.target.region2 ?? ""}`
                    : mapDefinition.name}
                </p>
              </div>
            </div>
            <KoreaGuessMap
              guess={game.guess}
              regions={mapDefinition.regions}
              showLabels={false}
              target={isReveal || isFinished ? game.currentResult?.target : undefined}
              distanceLabel={isReveal || isFinished ? game.formattedDistance ?? undefined : undefined}
              disabled={isReveal || isFinished}
              onGuess={game.setGuess}
            />
            {game.error ? <p className="inline-error">{game.error}</p> : null}
            <button
              className="submit-button"
              disabled={!game.guess || game.match.phase !== "active" || game.submitting}
              onClick={() => game.submitCurrentGuess()}
              type="button"
            >
              <Send size={18} aria-hidden="true" />
              {game.submitting ? "제출 중" : "추측 제출"}
            </button>
          </section>

          {isReveal && game.currentResult ? (
            <section className="panel-section result-panel" aria-live="polite">
              <RevealPanel
                score={game.currentResult.score}
                distance={game.formattedDistance ?? ""}
                targetTitle={game.currentResult.target.title}
                targetRegion={`${game.currentResult.target.region1} ${game.currentResult.target.region2}`}
                onNext={game.nextRound}
                isLastRound={roundNumber === game.match.roundCount}
              />
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone?: "timer";
}) {
  return (
    <span className={tone === "timer" ? "metric timer" : "metric"}>
      {icon}
      {label}
    </span>
  );
}

function RevealPanel({
  score,
  distance,
  targetTitle,
  targetRegion,
  onNext,
  isLastRound,
}: {
  score: number;
  distance: string;
  targetTitle: string;
  targetRegion: string;
  onNext: () => void;
  isLastRound: boolean;
}) {
  return (
    <div className="reveal-panel">
      <p>{targetRegion}</p>
      <h2>{targetTitle}</h2>
      <strong>{score.toLocaleString("ko-KR")}점</strong>
      <span>오차 {distance}</span>
      <button className="secondary-button" onClick={onNext} type="button">
        {isLastRound ? "최종 결과" : "다음 라운드"}
      </button>
    </div>
  );
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function FinalResultsPanel({
  totalScore,
  results,
  onRestart,
}: {
  totalScore: number;
  results: ApiMatch["results"];
  onRestart: () => void;
}) {
  const submittedResults = results.filter(
    (result) => result.distanceMeters !== null,
  );
  const averageDistance =
    submittedResults.length > 0
      ? submittedResults.reduce(
          (sum, result) => sum + (result.distanceMeters ?? 0),
          0,
        ) / submittedResults.length
      : null;
  const bestResult = [...submittedResults].sort(
    (a, b) => a.distanceMeters! - b.distanceMeters!,
  )[0];

  return (
    <section className="final-results" aria-label="최종 결과">
      <div className="final-summary">
        <p>게임 완료</p>
        <h2>최종 결과</h2>
        <strong>{totalScore.toLocaleString("ko-KR")}점</strong>
        <div className="final-stats">
          <StatBlock
            label="평균 오차"
            value={averageDistance === null ? "미제출" : formatDistance(averageDistance)}
          />
          <StatBlock
            label="최고 라운드"
            value={
              bestResult
                ? `R${bestResult.roundNumber} · ${formatDistance(bestResult.distanceMeters!)}`
                : "없음"
            }
          />
          <StatBlock
            label="완료 라운드"
            value={`${results.length}R`}
          />
        </div>
        <button className="secondary-button final-home-button" onClick={onRestart} type="button">
          <RotateCcw size={16} aria-hidden="true" />
          홈으로
        </button>
      </div>

      <div className="round-result-list" aria-label="라운드별 결과">
        {results.map((result) => (
          <article className="round-result-row" key={result.roundNumber}>
            <span>R{result.roundNumber}</span>
            <div>
              <strong>{result.target.region1} {result.target.region2}</strong>
              <p>{result.target.title}</p>
            </div>
            <em>
              {result.distanceMeters === null
                ? "미제출"
                : formatDistance(result.distanceMeters)}
            </em>
            <b>{result.score.toLocaleString("ko-KR")}점</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="final-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
