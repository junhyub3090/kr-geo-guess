import type { GameScope } from "./types.js";

const MAX_ROUND_SCORE = 5000;
const MAX_TIME_BONUS = 200;

const CLASSIC_SCOPES: Record<
  GameScope,
  { perfectRadiusMeters: number; decayMeters: number }
> = {
  national: { perfectRadiusMeters: 25, decayMeters: 140_000 },
  province: { perfectRadiusMeters: 20, decayMeters: 30_000 },
  city: { perfectRadiusMeters: 15, decayMeters: 8_000 },
};

export function scoreClassic(distance: number, scope: GameScope): number {
  const config = CLASSIC_SCOPES[scope];

  if (distance <= config.perfectRadiusMeters) {
    return MAX_ROUND_SCORE;
  }

  const adjustedDistance = distance - config.perfectRadiusMeters;
  const score = Math.round(
    MAX_ROUND_SCORE * Math.exp(-adjustedDistance / config.decayMeters),
  );

  return clamp(score, 0, MAX_ROUND_SCORE);
}

export function scoreTimedClassic(
  distance: number,
  scope: GameScope,
  timing?: { remainingSeconds: number | null; timerSeconds: number },
): number {
  const distanceScore = scoreClassic(distance, scope);
  return clamp(
    distanceScore + calculateTimeBonus(distanceScore, timing),
    0,
    MAX_ROUND_SCORE,
  );
}

export function calculateTimeBonus(
  distanceScore: number,
  timing?: { remainingSeconds: number | null; timerSeconds: number },
): number {
  if (
    !timing ||
    timing.remainingSeconds === null ||
    timing.timerSeconds <= 0 ||
    distanceScore <= 0
  ) {
    return 0;
  }

  const timeRatio = clamp(timing.remainingSeconds / timing.timerSeconds, 0, 1);
  const accuracyRatio = clamp(distanceScore / MAX_ROUND_SCORE, 0, 1);

  return Math.round(MAX_TIME_BONUS * timeRatio * accuracyRatio);
}

export function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${Math.round(distance)} m`;
  }

  return `${(distance / 1000).toFixed(1)} km`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
