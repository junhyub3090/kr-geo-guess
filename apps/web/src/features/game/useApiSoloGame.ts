import { formatDistance, type LatLng } from "@kr-geo-guess/shared";
import { useEffect, useMemo, useState } from "react";
import {
  advanceRound,
  submitGuess,
  type ApiMatch,
} from "../api/gameApi";
import {
  advanceStaticRound,
  isStaticMatch,
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
  nextRound: () => Promise<void>;
  replaceMatch: (match: ApiMatch) => void;
};

export function useApiSoloGame(initialMatch: ApiMatch): ApiSoloGameState {
  const [match, setMatch] = useState(initialMatch);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

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

    setSubmitting(true);
    setError(null);

    try {
      const submit = isStaticMatch(match.matchId) ? submitStaticGuess : submitGuess;
      const response = await submit({
        matchId: match.matchId,
        roundIndex: match.roundIndex,
        guess: finalGuess,
      });

      setMatch((current) => ({
        ...current,
        phase: "reveal",
        totalScore: response.totalScore,
        results: [...current.results, response.result],
      }));
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "제출에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
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

    const startedMatch = await startStaticRoundTimer(match.matchId);
    setNowMs(Date.now());
    setMatch(startedMatch);
  }

  async function nextRound() {
    setSubmitting(true);
    setError(null);

    try {
      const advance = isStaticMatch(match.matchId) ? advanceStaticRound : advanceRound;
      const nextMatch = await advance(match.matchId);
      setGuess(null);
      setMatch(nextMatch);
    } catch (advanceError) {
      setError(
        advanceError instanceof Error
          ? advanceError.message
          : "다음 라운드로 이동하지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
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
    nextRound,
    replaceMatch: setMatch,
  };
}
