import {
  formatDistance,
  type LatLng,
  type SeedIssueReason,
} from "@kr-geo-guess/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  advanceRound,
  reportSoloSeedIssue,
  submitGuess,
  type ApiMatch,
} from "../api/gameApi";
import {
  advanceStaticRound,
  isStaticMatch,
  reportStaticSeedIssue,
  startStaticRoundTimer,
  submitStaticGuess,
} from "../api/staticGameApi";

export type ApiSoloGameState = {
  match: ApiMatch;
  guess: LatLng | null;
  currentTargetForViewer: LatLng;
  currentResult: ApiMatch["results"][number] | null;
  formattedDistance: string | null;
  remainingSeconds: number;
  timerWaiting: boolean;
  submitting: boolean;
  error: string | null;
  setGuess: (guess: LatLng) => void;
  startRoundTimer: () => Promise<void>;
  submitCurrentGuess: () => Promise<void>;
  reportCurrentSeedIssue: (reason: SeedIssueReason) => Promise<void>;
  nextRound: () => Promise<void>;
  replaceMatch: (match: ApiMatch) => void;
};

export function useApiSoloGame(initialMatch: ApiMatch): ApiSoloGameState {
  const [match, setMatch] = useState(initialMatch);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const currentMatchRef = useRef(initialMatch);

  const currentResult =
    match.results.find(
      (result) => result.roundNumber === match.currentRound?.roundNumber,
    ) ?? null;
  const currentTargetForViewer = useMemo(() => {
    return match.currentRound?.roadviewTarget ?? currentResult?.target ?? {
      lat: 37.5665,
      lng: 126.978,
    };
  }, [currentResult?.target, match.currentRound?.roadviewTarget]);
  const formattedDistance = currentResult
    ? currentResult.distanceMeters === null
      ? "미제출"
      : formatDistance(currentResult.distanceMeters)
    : null;
  const remainingSeconds =
    match.phase === "active" && match.currentRound?.timerEndsAt
      ? Math.max(0, Math.ceil((match.currentRound.timerEndsAt - nowMs) / 1000))
      : 0;
  const timerWaiting =
    match.phase === "active" && match.currentRound?.timerEndsAt === null;

  useEffect(() => {
    currentMatchRef.current = initialMatch;
    setMatch(initialMatch);
    setGuess(null);
    setSubmitting(false);
    setError(null);
    setNowMs(Date.now());
  }, [initialMatch]);

  useEffect(() => {
    currentMatchRef.current = match;
  }, [match]);

  useEffect(() => {
    if (match.phase !== "active" || !match.currentRound?.timerEndsAt) {
      return undefined;
    }

    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [match.currentRound?.timerEndsAt, match.phase]);

  async function submitCurrentGuess(finalGuess: LatLng | null = guess) {
    if (match.phase !== "active") {
      return;
    }

    const requestMatchId = match.matchId;
    const requestRoundIndex = match.roundIndex;
    if (!isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const submit = isStaticMatch(match.matchId) ? submitStaticGuess : submitGuess;
      const response = await submit({
        matchId: match.matchId,
        roundIndex: match.roundIndex,
        guess: finalGuess,
      });

      if (!isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        return;
      }

      setMatch((current) =>
        current.matchId === requestMatchId &&
        current.roundIndex === requestRoundIndex
          ? {
              ...current,
              phase: "reveal",
              totalScore: response.totalScore,
              results: [...current.results, response.result],
            }
          : current,
      );
    } catch (submitError) {
      if (isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        setError(
          submitError instanceof Error ? submitError.message : "제출에 실패했습니다.",
        );
      }
    } finally {
      if (isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        setSubmitting(false);
      }
    }
  }

  async function startRoundTimer() {
    if (
      match.phase !== "active" ||
      match.currentRound?.timerEndsAt !== null ||
      !isStaticMatch(match.matchId)
    ) {
      return;
    }

    const requestMatchId = match.matchId;
    const requestRoundIndex = match.roundIndex;
    if (!isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
      return;
    }

    const startedMatch = await startStaticRoundTimer(match.matchId);
    if (!isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
      return;
    }

    setNowMs(Date.now());
    setMatch(startedMatch);
  }

  async function nextRound() {
    const requestMatchId = match.matchId;
    const requestRoundIndex = match.roundIndex;
    if (!isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const advance = isStaticMatch(match.matchId) ? advanceStaticRound : advanceRound;
      const nextMatch = await advance(match.matchId);
      if (!isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        return;
      }

      setGuess(null);
      setMatch(nextMatch);
    } catch (advanceError) {
      if (isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        setError(
          advanceError instanceof Error
            ? advanceError.message
            : "다음 라운드로 이동하지 못했습니다.",
        );
      }
    } finally {
      if (isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        setSubmitting(false);
      }
    }
  }

  async function reportCurrentSeedIssue(reason: SeedIssueReason) {
    if (match.phase !== "active" || !match.currentRound) {
      return;
    }

    const requestMatchId = match.matchId;
    const requestRoundIndex = match.roundIndex;
    const requestSeedId = match.currentRound.seedId;
    if (!isCurrentMatchRoundSeed(requestMatchId, requestRoundIndex, requestSeedId)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const reportIssue = isStaticMatch(match.matchId)
        ? reportStaticSeedIssue
        : reportSoloSeedIssue;
      const nextMatch = await reportIssue({
        matchId: match.matchId,
        roundIndex: match.roundIndex,
        seedId: requestSeedId,
        reason,
      });

      if (!isCurrentMatchRoundSeed(requestMatchId, requestRoundIndex, requestSeedId)) {
        return;
      }

      setGuess(null);
      setNowMs(Date.now());
      setMatch(nextMatch);
    } catch (issueError) {
      if (isCurrentMatchRoundSeed(requestMatchId, requestRoundIndex, requestSeedId)) {
        setError(
          issueError instanceof Error
            ? issueError.message
            : "로드뷰 없는 위치를 건너뛰지 못했습니다.",
        );
      }
    } finally {
      if (isCurrentMatchRound(requestMatchId, requestRoundIndex)) {
        setSubmitting(false);
      }
    }
  }

  useEffect(() => {
    if (
      match.phase === "active" &&
      !timerWaiting &&
      remainingSeconds === 0 &&
      !submitting
    ) {
      void submitCurrentGuess(guess);
    }
  }, [guess, match.phase, remainingSeconds, submitting, timerWaiting]);

  return {
    match,
    guess,
    currentTargetForViewer,
    currentResult,
    formattedDistance,
    remainingSeconds,
    timerWaiting,
    submitting,
    error,
    setGuess,
    startRoundTimer,
    submitCurrentGuess,
    reportCurrentSeedIssue,
    nextRound,
    replaceMatch,
  };

  function replaceMatch(nextMatch: ApiMatch) {
    currentMatchRef.current = nextMatch;
    setMatch(nextMatch);
  }

  function isCurrentMatchRound(matchId: string, roundIndex: number) {
    const current = currentMatchRef.current;
    return current.matchId === matchId && current.roundIndex === roundIndex;
  }

  function isCurrentMatchRoundSeed(
    matchId: string,
    roundIndex: number,
    seedId: string,
  ) {
    const current = currentMatchRef.current;
    return (
      current.matchId === matchId &&
      current.roundIndex === roundIndex &&
      current.currentRound?.seedId === seedId
    );
  }
}
