import { distanceMeters, isInsideKoreaBounds } from "./geo.js";
import { calculateTimeBonus, scoreClassic } from "./scoring.js";
import {
  deterministicShuffle,
  getGameMap,
  getSeedsForMapFromCatalog,
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
  SeedIssueReason,
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
  timeRemainingSeconds,
  timerSeconds,
}: {
  roundNumber: number;
  target: SeedLocation;
  guess: LatLng | null;
  scope: GameScope;
  timeRemainingSeconds?: number | null;
  timerSeconds?: number;
}): RoundGuessResult {
  const normalizedTimeRemaining = normalizeTimeRemaining(
    timeRemainingSeconds,
    timerSeconds,
  );

  if (!guess) {
    return {
      roundNumber,
      target,
      guess: null,
      distanceMeters: null,
      distanceScore: 0,
      timeBonus: 0,
      timeRemainingSeconds: normalizedTimeRemaining,
      score: 0,
    };
  }

  if (!isInsideKoreaBounds(guess)) {
    throw new Error("Guess is outside supported Korea bounds");
  }

  const distance = distanceMeters(target, guess);
  const distanceScore = scoreClassic(distance, scope);
  const timeBonus = Math.min(
    Math.max(0, 5000 - distanceScore),
    calculateTimeBonus(
      distanceScore,
      typeof timerSeconds === "number"
        ? {
            remainingSeconds: normalizedTimeRemaining,
            timerSeconds,
          }
        : undefined,
    ),
  );

  return {
    roundNumber,
    target,
    guess,
    distanceMeters: distance,
    distanceScore,
    timeBonus,
    timeRemainingSeconds: normalizedTimeRemaining,
    score: Math.min(5000, distanceScore + timeBonus),
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

export function replaceCurrentRoundSeed({
  plan,
  roundIndex,
  seedCatalog,
  excludedSeedIds = [],
  reason,
}: {
  plan: MatchPlan;
  roundIndex: number;
  seedCatalog: readonly SeedLocation[];
  excludedSeedIds?: Iterable<string>;
  reason: SeedIssueReason;
}): RoundPlan | null {
  const currentRound = getCurrentRound(plan, roundIndex);
  if (!currentRound) {
    return null;
  }

  const blockedSeedIds = new Set([
    ...plan.rounds.map((round) => round.seed.id),
    ...excludedSeedIds,
  ]);
  const candidates = getSeedsForMapFromCatalog(seedCatalog, plan.mapId).filter(
    (seed) => !blockedSeedIds.has(seed.id),
  );
  const preferredCandidates = candidates.filter(
    (seed) => seed.difficulty === currentRound.seed.difficulty,
  );
  const replacementPool =
    preferredCandidates.length > 0 ? preferredCandidates : candidates;
  const [replacementSeed] = deterministicShuffle(
    replacementPool,
    `${plan.id}-${roundIndex}-${currentRound.seed.id}-${reason}`,
  );

  if (!replacementSeed) {
    return null;
  }

  const replacementRound = {
    id: `round-${currentRound.roundNumber}-${replacementSeed.id}`,
    roundNumber: currentRound.roundNumber,
    seed: replacementSeed,
  };

  plan.rounds[roundIndex] = replacementRound;
  plan.id = `match-${plan.rounds.map((round) => round.seed.id).join("-")}`;

  return replacementRound;
}

function normalizeTimeRemaining(
  timeRemainingSeconds: number | null | undefined,
  timerSeconds: number | undefined,
) {
  if (
    timeRemainingSeconds === null ||
    timeRemainingSeconds === undefined ||
    timerSeconds === undefined ||
    !Number.isFinite(timeRemainingSeconds) ||
    !Number.isFinite(timerSeconds)
  ) {
    return null;
  }

  return Math.max(0, Math.min(timerSeconds, timeRemainingSeconds));
}
