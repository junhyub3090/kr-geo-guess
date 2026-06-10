import {
  Clock3,
  Flag,
  Home,
  Map as MapIcon,
  RotateCcw,
  Send,
  Trophy,
} from "lucide-react";
import { formatDistance, getGameMap } from "@kr-geo-guess/shared";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KakaoRoadviewPanel } from "../provider/KakaoRoadviewPanel";
import type { KakaoRoadviewStatus } from "../provider/kakaoTypes";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import { useApiSoloGame } from "./useApiSoloGame";
import type { ApiMatch } from "../api/gameApi";
import {
  formatClock,
  formatMapDifficulty,
  formatTargetAddress,
  getTimerProgressPercent,
  isUrgentTimer,
} from "./gameDisplay";
import {
  createFinalShareText,
  createRoundShareText,
  getResultLearningSummary,
} from "./gameInsights";
import { MetricPill } from "./MetricPill";
import { RoundProgressTrack } from "./RoundProgressTrack";
import type { PlayerProgressState } from "../progress/localPlayerProgress";

type RoundReadinessState = {
  key: string;
  guessMapReady: boolean;
  roadviewReady: boolean;
};

export function GameScreen({
  initialMatch,
  onExit,
  onSoloComplete,
  onRestartSameSettings,
  onRestartHarder,
  onRestartDifferentMap,
  progress,
}: {
  initialMatch: ApiMatch;
  onExit: () => void;
  onSoloComplete?: (match: ApiMatch) => void;
  onRestartSameSettings?: (match: ApiMatch) => void;
  onRestartHarder?: (match: ApiMatch) => void;
  onRestartDifferentMap?: (match: ApiMatch) => void;
  progress?: PlayerProgressState;
}) {
  const game = useApiSoloGame(initialMatch);
  const mapDefinition = getGameMap(game.match.mapId);
  const roundReadinessKey = `${game.match.matchId}:${game.match.roundIndex}:${game.match.currentRound?.seedId ?? "none"}`;
  const [roundReadiness, setRoundReadiness] = useState<RoundReadinessState>({
    key: roundReadinessKey,
    guessMapReady: false,
    roadviewReady: false,
  });
  const completedMatchIdRef = useRef<string | null>(null);
  const reportedNoPanoSeedIdRef = useRef<string | null>(null);
  const isReveal = game.match.phase === "reveal";
  const isFinished = game.match.phase === "finished";
  const roundNumber = game.match.currentRound?.roundNumber ?? game.match.roundCount;
  const timerRunning = !isReveal && !isFinished && !game.timerWaiting;
  const timerUrgent = timerRunning &&
    isUrgentTimer(game.remainingSeconds, game.match.timerSeconds);
  const timerLabel = isReveal || isFinished
    ? "공개 중"
    : game.timerWaiting
      ? "준비 중"
      : timerUrgent
        ? `곧 끝나요 · ${formatClock(game.remainingSeconds)}`
        : formatClock(game.remainingSeconds);
  const submitTimerLabel = game.timerWaiting
    ? "준비 중"
    : formatClock(game.remainingSeconds);
  const submitTimerProgress = timerRunning
    ? getTimerProgressPercent(game.match.timerSeconds, game.remainingSeconds)
    : "0%";
  const submitButtonClassName = [
    "submit-button",
    "timed-submit-button",
    game.guess && game.match.phase === "active" ? "ready" : "",
    timerUrgent ? "urgent" : "",
  ].filter(Boolean).join(" ");
  const submitButtonStyle = {
    "--timer-progress": submitTimerProgress,
  } as CSSProperties;
  const pinFeedbackLabel = game.submitting
    ? "제출 중"
    : game.guess
      ? "핀 위치가 선택되었습니다"
      : "지도를 눌러 핀을 놓으세요";
  const guessMapReady =
    roundReadiness.key === roundReadinessKey && roundReadiness.guessMapReady;
  const roadviewReady =
    roundReadiness.key === roundReadinessKey && roundReadiness.roadviewReady;
  const completedScores = useMemo(
    () =>
      new Map(
        game.match.results.map((result) => [result.roundNumber, result.score]),
      ),
    [game.match.results],
  );
  const handleRoadviewStatusChange = useCallback((status: KakaoRoadviewStatus) => {
    const isReady = status !== "loading" && status !== "no_pano";
    setRoundReadiness((current) =>
      current.key === roundReadinessKey
        ? { ...current, roadviewReady: isReady }
        : { key: roundReadinessKey, guessMapReady: false, roadviewReady: isReady },
    );

    if (
      status === "no_pano" &&
      game.match.currentRound &&
      reportedNoPanoSeedIdRef.current !== game.match.currentRound.seedId
    ) {
      reportedNoPanoSeedIdRef.current = game.match.currentRound.seedId;
      void game.reportCurrentSeedIssue("no_pano");
    }
  }, [game, roundReadinessKey]);
  const handleGuessMapReady = useCallback(() => {
    setRoundReadiness((current) =>
      current.key === roundReadinessKey
        ? { ...current, guessMapReady: true }
        : { key: roundReadinessKey, guessMapReady: true, roadviewReady: false },
    );
  }, [roundReadinessKey]);

  useEffect(() => {
    reportedNoPanoSeedIdRef.current = null;
  }, [roundReadinessKey]);

  useEffect(() => {
    if (game.timerWaiting && guessMapReady && roadviewReady) {
      void game.startRoundTimer();
    }
  }, [game, guessMapReady, roadviewReady]);

  useEffect(() => {
    if (
      isFinished &&
      completedMatchIdRef.current !== game.match.matchId
    ) {
      completedMatchIdRef.current = game.match.matchId;
      onSoloComplete?.(game.match);
    }
  }, [game.match, isFinished, onSoloComplete]);

  if (isFinished) {
    return (
      <main className="app-shell final-shell">
        <header className="topbar">
          <div className="brand-block">
            <h1>어디길</h1>
          </div>
          <div className="round-metrics" aria-label="최종 결과 정보">
            <MetricPill
              icon={<MapIcon size={16} />}
              label={formatMapDifficulty(
                game.match.mapName,
                game.match.difficultyMode,
              )}
            />
            <MetricPill icon={<Flag size={16} />} label={`${game.match.roundCount}라운드 완료`} />
            <MetricPill icon={<Trophy size={16} />} label={game.match.totalScore.toLocaleString("ko-KR")} />
            <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
              <Home size={16} />
            </button>
          </div>
        </header>
        <FinalResultsPanel
          match={game.match}
          onHome={onExit}
          onRestartSameSettings={() => onRestartSameSettings?.(game.match)}
          onRestartHarder={() => onRestartHarder?.(game.match)}
          onRestartDifferentMap={() => onRestartDifferentMap?.(game.match)}
          progress={progress}
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
          <MetricPill
            icon={<MapIcon size={16} />}
            label={formatMapDifficulty(
              game.match.mapName,
              game.match.difficultyMode,
            )}
          />
          <MetricPill icon={<Flag size={16} />} label={`${roundNumber} / ${game.match.roundCount}라운드`} />
          <MetricPill
            icon={<Clock3 size={16} />}
            label={timerLabel}
            tone="timer"
            urgent={timerUrgent}
            progress={submitTimerProgress}
          />
          <MetricPill icon={<Trophy size={16} />} label={game.match.totalScore.toLocaleString("ko-KR")} />
          <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
            <Home size={16} />
          </button>
        </div>
      </header>

      <RoundProgressTrack
        completedScores={completedScores}
        currentRoundNumber={roundNumber}
        roundCount={game.match.roundCount}
      />

      <section className="game-layout">
        <KakaoRoadviewPanel
          target={game.currentTargetForViewer}
          onStatusChange={handleRoadviewStatusChange}
        />

        <aside className="side-panel" aria-label="추측과 방 상태">
          <section
            className={[
              "panel-section",
              "map-panel",
              isReveal ? "reveal-map-panel" : "",
              game.guess && !isReveal ? "has-guess" : "",
            ].filter(Boolean).join(" ")}
          >
            <div className="section-heading">
              <div>
                <h2>{isReveal ? "결과 확인" : "지도에 핀 찍기"}</h2>
                <p>
                  {isReveal
                    ? `정답 · ${
                        game.currentResult
                          ? formatTargetAddress(game.currentResult.target)
                          : ""
                      }`
                    : mapDefinition.name}
                </p>
              </div>
              {!isReveal ? (
                <div className="solo-map-action-state">
                  <span
                    className={game.guess ? "guess-ready-chip ready" : "guess-ready-chip"}
                  >
                    {game.guess ? "핀 선택됨" : "지도에서 선택"}
                  </span>
                  <p className="guess-feedback" aria-label="핀 피드백" aria-live="polite">
                    {pinFeedbackLabel}
                  </p>
                </div>
              ) : null}
            </div>
            <KoreaGuessMap
              guess={game.guess}
              regions={mapDefinition.regions}
              resetKey={`${game.match.roundIndex}:${game.match.currentRound?.seedId ?? "pending"}`}
              showLabels={false}
              target={isReveal || isFinished ? game.currentResult?.target : undefined}
              distanceLabel={isReveal || isFinished ? game.formattedDistance ?? undefined : undefined}
              disabled={isReveal || isFinished}
              onReady={handleGuessMapReady}
              onGuess={game.setGuess}
            />
            {game.error ? <p className="inline-error">{game.error}</p> : null}
            {isReveal ? null : (
              <button
                className={submitButtonClassName}
                disabled={!game.guess || game.match.phase !== "active" || game.submitting}
                onClick={() => game.submitCurrentGuess()}
                style={submitButtonStyle}
                type="button"
              >
                <Send size={18} aria-hidden="true" />
                <span>{game.submitting ? "찍는 중" : "위치 찍기"}</span>
                <span className="submit-timer-label">{submitTimerLabel}</span>
              </button>
            )}
          </section>

          {isReveal && game.currentResult ? (
            <section className="panel-section result-panel" aria-live="polite">
              <RevealPanel
                mapName={game.match.mapName}
                result={game.currentResult}
                distance={game.formattedDistance ?? ""}
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

function RevealPanel({
  mapName,
  result,
  distance,
  onNext,
  isLastRound,
}: {
  mapName: string;
  result: ApiMatch["results"][number];
  distance: string;
  onNext: () => void;
  isLastRound: boolean;
}) {
  const proximityLabel = getProximityLabel(result.distanceMeters);
  const learning = getResultLearningSummary(result);
  const shareText = createRoundShareText(result, mapName);

  return (
    <div className="reveal-panel">
      <p>라운드 결과</p>
      <span className="result-tone" aria-label="결과 톤">{learning.tone}</span>
      <AnimatedScore
        value={result.score}
        className="score-count-up"
        ariaLabel="라운드 점수"
      />
      <div className="reveal-metric-row">
        <span>{result.distanceMeters === null ? "미제출" : distance}</span>
        <em>{proximityLabel}</em>
      </div>
      <div className="score-breakdown" aria-label="점수 구성">
        <span>
          거리 점수
          <strong>{result.distanceScore.toLocaleString("ko-KR")}</strong>
        </span>
        <span>
          시간 보너스
          <strong>{result.timeBonus.toLocaleString("ko-KR")}</strong>
        </span>
      </div>
      <div className="learning-clues" aria-label="지역 단서">
        {learning.clues.map((clue) => (
          <span key={clue}>{clue}</span>
        ))}
      </div>
      <p className="result-share-copy" aria-label="공유 문구">{shareText}</p>
      <p className="result-learning-hint" aria-label="지역 힌트">
        {learning.hint}
      </p>
      <h2>{learning.address}</h2>
      <button className="secondary-button" onClick={onNext} type="button">
        {isLastRound ? "최종 결과" : "다음 라운드"}
      </button>
    </div>
  );
}

function getProximityLabel(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return "기록 없음";
  }

  if (distanceMeters <= 120) {
    return "초근접";
  }

  if (distanceMeters <= 1_000) {
    return "근접";
  }

  if (distanceMeters <= 10_000) {
    return "감 좋음";
  }

  return "다음 라운드";
}

function FinalResultsPanel({
  match,
  onHome,
  onRestartSameSettings,
  onRestartHarder,
  onRestartDifferentMap,
  progress,
}: {
  match: ApiMatch;
  onHome: () => void;
  onRestartSameSettings?: () => void;
  onRestartHarder?: () => void;
  onRestartDifferentMap?: () => void;
  progress?: PlayerProgressState;
}) {
  const results = match.results;
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
  const bestScoreResult = [...results].sort((a, b) => b.score - a.score)[0];
  const worstResult = [...submittedResults].sort(
    (a, b) => b.distanceMeters! - a.distanceMeters!,
  )[0];
  const shareText = createFinalShareText(match);
  const currentStreak = progress?.dailyStreak.current ?? 0;

  return (
    <section className="final-results" aria-label="최종 결과">
      <div className="final-summary">
        <p>게임 완료</p>
        <h2>최종 결과</h2>
        {match.daily ? (
          <p className="daily-result-note" aria-label="데일리 기록 상태">
            {match.daily.official ? "공식 데일리 기록" : "데일리 연습 기록"}
          </p>
        ) : null}
        <AnimatedScore
          value={match.totalScore}
          className="final-total-score"
          ariaLabel="최종 점수"
        />
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
        <p className="result-share-copy final-share-copy" aria-label="최종 공유 문구">
          {shareText}
        </p>
        <div className="final-decision-grid" aria-label="이번 게임 요약">
          <StatBlock
            label="가장 잘한 라운드"
            value={
              bestScoreResult
                ? `R${bestScoreResult.roundNumber} · ${bestScoreResult.score.toLocaleString("ko-KR")}점`
                : "없음"
            }
          />
          <StatBlock
            label="가장 크게 빗나간 라운드"
            value={
              worstResult
                ? `R${worstResult.roundNumber} · ${formatDistance(worstResult.distanceMeters!)}`
                : "없음"
            }
          />
          <StatBlock
            label="데일리 연속"
            value={currentStreak > 0 ? `${currentStreak}일` : "기록 전"}
          />
        </div>
        <div className="final-action-row" aria-label="반복 플레이 선택">
          <button
            className="secondary-button final-home-button"
            onClick={onRestartSameSettings}
            type="button"
          >
            <RotateCcw size={16} aria-hidden="true" />
            같은 설정 다시
          </button>
          <button
            className="secondary-button final-home-button"
            onClick={onRestartHarder}
            type="button"
          >
            <Trophy size={16} aria-hidden="true" />
            더 어렵게
          </button>
          <button
            className="secondary-button final-home-button"
            onClick={onRestartDifferentMap}
            type="button"
          >
            <MapIcon size={16} aria-hidden="true" />
            다른 지역
          </button>
          <button className="secondary-button final-home-button" onClick={onHome} type="button">
            <Home size={16} aria-hidden="true" />
            홈으로
          </button>
        </div>
      </div>

      <div className="round-result-list" aria-label="라운드별 결과">
        {results.map((result) => (
          <article className="round-result-row" key={result.roundNumber}>
            <span>R{result.roundNumber}</span>
            <div>
              <strong>{formatTargetAddress(result.target)}</strong>
              <div className="learning-clues compact" aria-label={`R${result.roundNumber} 지역 단서`}>
                {getResultLearningSummary(result).clues.map((clue) => (
                  <span key={clue}>{clue}</span>
                ))}
              </div>
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

function AnimatedScore({
  value,
  className,
  ariaLabel,
}: {
  value: number;
  className: string;
  ariaLabel: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const durationMs = 420;
    const startTime = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * easedProgress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <strong className={className} aria-label={ariaLabel}>
      {displayValue.toLocaleString("ko-KR")}점
    </strong>
  );
}
