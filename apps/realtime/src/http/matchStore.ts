import {
  KOREA_SEED_CATALOG,
  createLeaderboard,
  createMatchPlan,
  createPublicRound,
  createRoomCode,
  getGameMap,
  getCurrentRound,
  getNextRoundIndex,
  getSeedsForMapFromCatalog,
  normalizeNickname,
  submitRoundGuess,
  type GameDifficultyMode,
  type LatLng,
  type LeaderboardEntry,
  type LeaderboardInput,
  type MatchPlan,
  type RoundGuessResult,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import {
  createMemoryLeaderboardStore,
  type SharedLeaderboardStore,
} from "./leaderboardStore.js";

type SoloPhase = "active" | "reveal" | "finished";

type SoloMatch = {
  id: string;
  roomCode: string;
  player: {
    id: string;
    nickname: string;
  };
  phase: SoloPhase;
  roundIndex: number;
  plan: MatchPlan;
  results: RoundGuessResult[];
  createdAt: number;
  roundStartedAt: number;
};

type SharedLeaderboardScoreInput = {
  nickname: string;
  totalScore: number;
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  difficultyMode: GameDifficultyMode;
  mapName: string;
};

export type MatchStore = ReturnType<typeof createMatchStore>;

export function createMatchStore(options?: {
  now?: () => number;
  seedCatalog?: readonly SeedLocation[];
  leaderboardStore?: SharedLeaderboardStore;
}) {
  const now = options?.now ?? Date.now;
  const seedCatalog = options?.seedCatalog ?? KOREA_SEED_CATALOG;
  const leaderboardStore =
    options?.leaderboardStore ?? createMemoryLeaderboardStore();
  const matches = new Map<string, SoloMatch>();
  let sequence = 0;
  let leaderboardSequence = 0;

  function createSoloMatch(
    rawNickname: string,
    rawMapId?: string,
    rawDifficultyMode?: string,
    rawTimerSeconds?: unknown,
  ) {
    sequence += 1;
    const nickname = normalizeNickname(rawNickname);
    const gameMap = getGameMap(rawMapId);
    const difficultyMode = normalizeDifficultyMode(rawDifficultyMode);
    const timerSeconds = normalizeTimerSeconds(rawTimerSeconds);
    const idSeed = `${now()}-${sequence}-${nickname}-${gameMap.id}-${difficultyMode}`;
    const mapSeeds = getSeedsForMapFromCatalog(seedCatalog, gameMap.id);
    const plan = createMatchPlan(mapSeeds, {
      roundCount: 5,
      timerSeconds,
      idSeed,
      mapId: gameMap.id,
      difficultyMode,
    });
    const id = `solo-${sequence.toString(36)}-${Math.abs(now()).toString(36)}`;
    const createdAt = now();
    const match: SoloMatch = {
      id,
      roomCode: createRoomCode(id),
      player: {
        id: `guest-${sequence.toString(36)}`,
        nickname,
      },
      phase: "active",
      roundIndex: 0,
      plan,
      results: [],
      createdAt,
      roundStartedAt: createdAt,
    };

    matches.set(match.id, match);
    return serializeMatch(match);
  }

  function getSoloMatch(id: string) {
    const match = getMatchOrThrow(id);
    return serializeMatch(match);
  }

  function submitGuess(id: string, roundIndex: number, guess: LatLng | null) {
    const match = getMatchOrThrow(id);
    const submittedAt = now();

    if (match.phase !== "active") {
      throw new MatchConflictError("Current round is not accepting guesses");
    }

    if (roundIndex !== match.roundIndex) {
      throw new MatchConflictError("Guess round does not match current round");
    }

    if (match.results.some((result) => result.roundNumber === roundIndex + 1)) {
      throw new MatchConflictError("Round already has a submitted guess");
    }

    const round = getCurrentRound(match.plan, match.roundIndex);

    if (!round) {
      throw new MatchConflictError("Current round is missing");
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

  function advanceRound(id: string) {
    const match = getMatchOrThrow(id);

    if (match.phase !== "reveal") {
      throw new MatchConflictError("Match can advance only after reveal");
    }

    const nextIndex = getNextRoundIndex(match.plan, match.roundIndex);

    if (nextIndex === null) {
      match.phase = "finished";
      return serializeMatch(match);
    }

    match.roundIndex = nextIndex;
    match.phase = "active";
    match.roundStartedAt = now();
    return serializeMatch(match);
  }

  function getLeaderboard(): LeaderboardEntry[] {
    const completedMatchEntries = [...matches.values()]
      .filter((match) => match.results.length > 0)
      .map((match) => ({
        playerId: match.player.id,
        nickname: match.player.nickname,
        totalScore: getTotalScore(match),
        totalDistanceMeters: match.results.reduce(
          (sum, result) => sum + (result.distanceMeters ?? 0),
          0,
        ),
        totalTimeSeconds: getTotalElapsedSeconds(match),
        difficultyMode: match.plan.difficultyMode,
        mapName: match.plan.mapName,
      }));

    return createLeaderboard([
      ...completedMatchEntries,
      ...leaderboardStore.getScores(),
    ]);
  }

  function recordLeaderboardScore(input: SharedLeaderboardScoreInput) {
    leaderboardSequence += 1;
    const entry: LeaderboardInput = {
      playerId: `shared-${Math.abs(now()).toString(36)}-${leaderboardSequence.toString(36)}`,
      nickname: normalizeNickname(input.nickname),
      totalScore: input.totalScore,
      totalDistanceMeters: input.totalDistanceMeters,
      totalTimeSeconds: input.totalTimeSeconds,
      difficultyMode: input.difficultyMode,
      mapName: input.mapName.trim() || "전국",
    };

    leaderboardStore.addScore(entry);
    return getLeaderboard().find((item) => item.playerId === entry.playerId)!;
  }

  function getMatchOrThrow(id: string) {
    const match = matches.get(id);

    if (!match) {
      throw new MatchNotFoundError(id);
    }

    return match;
  }

  return {
    createSoloMatch,
    getSoloMatch,
    submitGuess,
    advanceRound,
    getLeaderboard,
    recordLeaderboardScore,
  };
}

export class MatchNotFoundError extends Error {
  constructor(id: string) {
    super(`Match not found: ${id}`);
  }
}

export class MatchConflictError extends Error {}

function serializeMatch(match: SoloMatch) {
  const currentRound = getCurrentRound(match.plan, match.roundIndex);
  const timerEndsAt =
    match.phase === "active"
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

function getTotalScore(match: SoloMatch): number {
  return match.results.reduce((sum, result) => sum + result.score, 0);
}

function getTotalElapsedSeconds(match: SoloMatch): number {
  return match.results.reduce(
    (sum, result) =>
      sum + (match.plan.timerSeconds - (result.timeRemainingSeconds ?? 0)),
    0,
  );
}

function getRemainingSeconds(match: SoloMatch, currentTime: number): number {
  const timerEndsAt = match.roundStartedAt + match.plan.timerSeconds * 1000;
  return Math.max(0, Math.ceil((timerEndsAt - currentTime) / 1000));
}

function normalizeDifficultyMode(value: string | undefined): GameDifficultyMode {
  if (
    value === "easy" ||
    value === "normal" ||
    value === "hard" ||
    value === "mixed"
  ) {
    return value;
  }

  return "normal";
}

function normalizeTimerSeconds(value: unknown) {
  if (value === 45 || value === 60 || value === 90) {
    return value;
  }

  return 30;
}
