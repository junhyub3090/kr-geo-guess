import {
  createMatchPlan,
  distanceMeters,
  formatDistance,
  getCurrentRound,
  getNextRoundIndex,
  scoreClassic,
  type LatLng,
  type MatchPlan,
  type RoundPlan,
} from "@kr-geo-guess/shared";
import { useMemo, useState } from "react";
import { SAMPLE_SEEDS } from "./sampleSeeds";

type Phase = "active" | "reveal" | "finished";

export type RoundResult = {
  roundNumber: number;
  target: LatLng;
  guess: LatLng;
  distanceMeters: number;
  score: number;
};

export type SoloGameState = {
  match: MatchPlan;
  phase: Phase;
  currentRound: RoundPlan;
  roundIndex: number;
  guess: LatLng | null;
  currentResult: RoundResult | null;
  results: RoundResult[];
  totalScore: number;
  formattedDistance: string | null;
  setGuess: (guess: LatLng) => void;
  submitGuess: () => void;
  nextRound: () => void;
  restart: () => void;
};

export function useSoloGame(): SoloGameState {
  const [restartKey, setRestartKey] = useState(0);
  const match = useMemo(
    () => createMatchPlan(SAMPLE_SEEDS, { roundCount: 5, timerSeconds: 30 }),
    [restartKey],
  );
  const [phase, setPhase] = useState<Phase>("active");
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);

  const maybeCurrentRound = getCurrentRound(match, roundIndex);

  if (!maybeCurrentRound) {
    throw new Error("Current round is missing");
  }

  const currentRound = maybeCurrentRound;

  const currentResult = results.find(
    (result) => result.roundNumber === currentRound.roundNumber,
  ) ?? null;
  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const formattedDistance = currentResult
    ? formatDistance(currentResult.distanceMeters)
    : null;

  function submitGuess() {
    if (!guess || phase !== "active") {
      return;
    }

    const distance = distanceMeters(currentRound.seed, guess);
    const score = scoreClassic(distance, "national");
    const result: RoundResult = {
      roundNumber: currentRound.roundNumber,
      target: currentRound.seed,
      guess,
      distanceMeters: distance,
      score,
    };

    setResults((existing) => [...existing, result]);
    setPhase("reveal");
  }

  function nextRound() {
    const nextIndex = getNextRoundIndex(match, roundIndex);

    if (nextIndex === null) {
      setPhase("finished");
      return;
    }

    setRoundIndex(nextIndex);
    setGuess(null);
    setPhase("active");
  }

  function restart() {
    setRestartKey((key) => key + 1);
    setPhase("active");
    setRoundIndex(0);
    setGuess(null);
    setResults([]);
  }

  return {
    match,
    phase,
    currentRound,
    roundIndex,
    guess,
    currentResult,
    results,
    totalScore,
    formattedDistance,
    setGuess,
    submitGuess,
    nextRound,
    restart,
  };
}
