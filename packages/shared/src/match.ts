import { distanceMeters, isInsideKoreaBounds } from "./geo.js";
import { scoreClassic } from "./scoring.js";
import {
  deterministicShuffle,
  getGameMap,
  selectDifficultyWeightedSeeds,
} from "./seeds.js";
import type {
  GameDifficultyMode,
  GameScope,
  LatLng,
  MatchPlan,
  PublicRound,
  RoundGuessResult,
  RoundPlan,
  SeedLocation,
} from "./types.js";

export function createMatchPlan(
  seeds: readonly SeedLocation[],
  options: {
    roundCount: number;
    timerSeconds: number;
    idSeed?: string;
    mapId?: string;
    difficultyMode?: GameDifficultyMode;
  },
): MatchPlan {
  const gameMap = getGameMap(options.mapId);
  const difficultyMode = options.difficultyMode ?? "normal";
  const baseSeeds = options.idSeed
    ? deterministicShuffle(seeds, options.idSeed)
    : seeds;
  const selectedSeeds = selectDifficultyWeightedSeeds(
    baseSeeds,
    options.roundCount,
    difficultyMode,
  );

  return {
    id: `match-${selectedSeeds.map((seed) => seed.id).join("-")}`,
    mapId: gameMap.id,
    mapName: gameMap.name,
    difficultyMode,
    timerSeconds: options.timerSeconds,
    rounds: selectedSeeds.map((seed, index) => ({
      id: `round-${index + 1}-${seed.id}`,
      roundNumber: index + 1,
      seed,
    })),
  };
}

export function createDailyChallenge(
  seeds: readonly SeedLocation[],
  koreaDate: string,
): MatchPlan {
  return {
    ...createMatchPlan(seeds, {
      roundCount: Math.min(5, seeds.length),
      timerSeconds: 30,
      idSeed: `daily-${koreaDate}`,
      mapId: "kr-all",
      difficultyMode: "mixed",
    }),
    id: `daily-${koreaDate}`,
  };
}

export function createPublicRound(
  seed: SeedLocation,
  roundNumber: number,
  timerEndsAt: number | null,
  map?: { id: string; name: string },
): PublicRound {
  return {
    roundNumber,
    seedId: seed.id,
    regionHint: seed.region1,
    mapId: map?.id ?? "kr-all",
    mapName: map?.name ?? "전국",
    difficulty: seed.difficulty,
    tags: seed.tags,
    roadviewTarget: { lat: seed.lat, lng: seed.lng },
    timerEndsAt,
  };
}

export function submitRoundGuess({
  roundNumber,
  target,
  guess,
  scope,
}: {
  roundNumber: number;
  target: SeedLocation;
  guess: LatLng | null;
  scope: GameScope;
}): RoundGuessResult {
  if (!guess) {
    return {
      roundNumber,
      target,
      guess: null,
      distanceMeters: null,
      score: 0,
    };
  }

  if (!isInsideKoreaBounds(guess)) {
    throw new Error("Guess is outside supported Korea bounds");
  }

  const distance = distanceMeters(target, guess);

  return {
    roundNumber,
    target,
    guess,
    distanceMeters: distance,
    score: scoreClassic(distance, scope),
  };
}

export function getCurrentRound(
  plan: MatchPlan,
  roundIndex: number,
): RoundPlan | null {
  return plan.rounds[roundIndex] ?? null;
}

export function getNextRoundIndex(
  plan: MatchPlan,
  roundIndex: number,
): number | null {
  const nextIndex = roundIndex + 1;

  return nextIndex < plan.rounds.length ? nextIndex : null;
}
