import type { GameScope } from "./types.js";

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
    return 5000;
  }

  const adjustedDistance = distance - config.perfectRadiusMeters;
  const score = Math.round(
    5000 * Math.exp(-adjustedDistance / config.decayMeters),
  );

  return clamp(score, 0, 5000);
}

export function scoreDuelDamage(
  playerScore: number,
  opponentScore: number,
  roundNumber: number,
): number {
  const difference = playerScore - opponentScore;

  if (difference <= 0) {
    return 0;
  }

  const multiplier = roundNumber >= 6 ? 2 : 1;
  return difference * multiplier;
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
