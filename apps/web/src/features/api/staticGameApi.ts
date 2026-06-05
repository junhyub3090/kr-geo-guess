import {
  KOREA_SEED_CATALOG,
  MIN_PLAYABLE_SEED_COUNT,
  createMatchPlan,
  createPublicRound,
  getCurrentRound,
  getGameMap,
  getMapSummariesFromCatalog,
  getNextRoundIndex,
  getSeedsForMapFromCatalog,
  replaceCurrentRoundSeed,
  submitRoundGuess,
  type LatLng,
  type MatchPlan,
  type RoundGuessResult,
  type SeedIssueReason,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import runtimeSeedCatalogUrl from "../../../../../data/seed-pipeline/runtime/verified-seeds.json?url";
import type { ApiMatch, GameDifficultyMode } from "./gameApi";

type StaticMatch = {
  id: string;
  roomCode: string;
  player: ApiMatch["player"];
  phase: ApiMatch["phase"];
  roundIndex: number;
  plan: MatchPlan;
  results: RoundGuessResult[];
  roundStartedAt: number | null;
  excludedSeedIds: Set<string>;
};

const staticMatches = new Map<string, StaticMatch>();
let seedCatalogPromise: Promise<readonly SeedLocation[]> | null = null;

export function isStaticMatch(matchId: string) {
  return matchId.startsWith("static-");
}

export async function getStaticGameMaps() {
  const seedCatalog = await loadStaticSeedCatalog();
  return getMapSummariesFromCatalog(seedCatalog);
}

export async function createStaticSoloMatch(
  nickname: string,
  mapId: string,
  difficultyMode: GameDifficultyMode,
  timerSeconds = 30,
): Promise<ApiMatch> {
  const seedCatalog = await loadStaticSeedCatalog();
  const seedSelection = getPlayableSeedSelection(seedCatalog, mapId);
  if (!seedSelection) {
    throw new Error("플레이 가능한 위치가 부족합니다. 잠시 후 다시 시도해 주세요.");
  }

  const { gameMap, mapSeeds } = seedSelection;
  const id = `static-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const plan = createMatchPlan(mapSeeds, {
    roundCount: MIN_PLAYABLE_SEED_COUNT,
    timerSeconds,
    idSeed: id,
    mapId: gameMap.id,
    difficultyMode,
  });
  const match: StaticMatch = {
    id,
    roomCode: "SOLO",
    player: {
      id: "local-player",
      nickname: nickname.trim() || "게스트",
    },
    phase: "active",
    roundIndex: 0,
    plan,
    results: [],
    roundStartedAt: null,
    excludedSeedIds: new Set(),
  };

  staticMatches.set(match.id, match);
  return serializeStaticMatch(match);
}

export async function startStaticRoundTimer(matchId: string): Promise<ApiMatch> {
  const match = getStaticMatch(matchId);

  if (match.phase !== "active") {
    return serializeStaticMatch(match);
  }

  match.roundStartedAt ??= Date.now();
  return serializeStaticMatch(match);
}

export async function submitStaticGuess({
  matchId,
  roundIndex,
  guess,
}: {
  matchId: string;
  roundIndex: number;
  guess: LatLng | null;
}) {
  const match = getStaticMatch(matchId);
  const submittedAt = Date.now();

  if (match.phase !== "active") {
    throw new Error("Current round is not accepting guesses");
  }

  if (roundIndex !== match.roundIndex) {
    throw new Error("Guess round does not match current round");
  }

  const round = getCurrentRound(match.plan, match.roundIndex);
  if (!round) {
    throw new Error("Current round is missing");
  }

  const result = submitRoundGuess({
    roundNumber: round.roundNumber,
    target: round.seed,
    guess,
    scope: match.plan.mapId === "kr-all" ? "national" : getGameMap(match.plan.mapId).scope,
    timeRemainingSeconds: getRemainingSeconds(match, submittedAt),
    timerSeconds: match.plan.timerSeconds,
  });

  match.results.push(result);
  match.phase = "reveal";

  return {
    matchId: match.id,
    phase: match.phase,
    result,
    totalScore: getTotalScore(match),
    nextRoundAvailable: getNextRoundIndex(match.plan, match.roundIndex) !== null,
  };
}

export async function advanceStaticRound(matchId: string): Promise<ApiMatch> {
  const match = getStaticMatch(matchId);

  if (match.phase !== "reveal") {
    throw new Error("Match can advance only after reveal");
  }

  const nextIndex = getNextRoundIndex(match.plan, match.roundIndex);
  if (nextIndex === null) {
    match.phase = "finished";
    return serializeStaticMatch(match);
  }

  match.roundIndex = nextIndex;
  match.phase = "active";
  match.roundStartedAt = null;
  return serializeStaticMatch(match);
}

export async function reportStaticSeedIssue({
  matchId,
  roundIndex,
  seedId,
  reason,
}: {
  matchId: string;
  roundIndex: number;
  seedId: string;
  reason: SeedIssueReason;
}): Promise<ApiMatch> {
  const match = getStaticMatch(matchId);

  if (match.phase !== "active" || roundIndex !== match.roundIndex) {
    return serializeStaticMatch(match);
  }

  const currentRound = getCurrentRound(match.plan, match.roundIndex);
  if (!currentRound || currentRound.seed.id !== seedId) {
    return serializeStaticMatch(match);
  }

  match.excludedSeedIds.add(seedId);
  const seedCatalog = await loadStaticSeedCatalog();
  const replacementRound = replaceCurrentRoundSeed({
    plan: match.plan,
    roundIndex: match.roundIndex,
    seedCatalog,
    excludedSeedIds: match.excludedSeedIds,
    reason,
  });

  if (!replacementRound) {
    throw new Error("No replacement seed is available");
  }

  match.roundStartedAt = null;
  return serializeStaticMatch(match);
}

function getStaticMatch(matchId: string) {
  const match = staticMatches.get(matchId);
  if (!match) {
    throw new Error("Static match not found");
  }

  return match;
}

function serializeStaticMatch(match: StaticMatch): ApiMatch {
  const currentRound = getCurrentRound(match.plan, match.roundIndex);
  const timerEndsAt =
    match.phase === "active" && match.roundStartedAt !== null
      ? match.roundStartedAt + match.plan.timerSeconds * 1000
      : null;

  return {
    matchId: match.id,
    roomCode: match.roomCode,
    player: match.player,
    phase: match.phase,
    mapId: match.plan.mapId,
    mapName: match.plan.mapName,
    difficultyMode: match.plan.difficultyMode,
    roundIndex: match.roundIndex,
    roundCount: match.plan.rounds.length,
    timerSeconds: match.plan.timerSeconds,
    totalScore: getTotalScore(match),
    currentRound:
      currentRound && match.phase !== "finished"
        ? createPublicRound(currentRound.seed, currentRound.roundNumber, timerEndsAt, {
            id: match.plan.mapId,
            name: match.plan.mapName,
          })
        : null,
    results: match.results,
  };
}

function getTotalScore(match: StaticMatch) {
  return match.results.reduce((sum, result) => sum + result.score, 0);
}

function getRemainingSeconds(match: StaticMatch, currentTime: number): number {
  if (match.roundStartedAt === null) {
    return match.plan.timerSeconds;
  }

  const timerEndsAt = match.roundStartedAt + match.plan.timerSeconds * 1000;
  return Math.max(0, Math.ceil((timerEndsAt - currentTime) / 1000));
}

function loadStaticSeedCatalog(): Promise<readonly SeedLocation[]> {
  seedCatalogPromise ??= fetch(runtimeSeedCatalogUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Static seed request failed: ${response.status}`);
      }

      return response.json() as Promise<SeedLocation[]>;
    })
    .catch(() => KOREA_SEED_CATALOG);

  return seedCatalogPromise;
}

function getPlayableSeedSelection(
  seedCatalog: readonly SeedLocation[],
  requestedMapId: string,
) {
  const requestedGameMap = getGameMap(requestedMapId);
  const requestedSeeds = getSeedsForMapFromCatalog(
    seedCatalog,
    requestedGameMap.id,
  );

  if (requestedSeeds.length >= MIN_PLAYABLE_SEED_COUNT) {
    return {
      gameMap: requestedGameMap,
      mapSeeds: requestedSeeds,
    };
  }

  return null;
}
