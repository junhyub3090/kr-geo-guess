import type { ApiMatch, GameDifficultyMode, LeaderboardGameMode } from "../api/gameApi";

export type CompletedGameSummary = {
  id: string;
  completedAt: string;
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  totalScore: number;
  averageDistanceMeters: number | null;
  bestRoundScore: number;
  worstRoundDistanceMeters: number | null;
  roundCount: number;
  mode: LeaderboardGameMode | "daily";
};

export type DailyStreak = {
  current: number;
  best: number;
  lastDate: string | null;
};

export type PlayerProgressState = {
  recentGames: CompletedGameSummary[];
  dailyStreak: DailyStreak;
};

export const PLAYER_PROGRESS_STORAGE_KEY = "kr-geo-guess:player-progress:v1";

const MAX_RECENT_GAMES = 30;
const MAX_ROUND_COUNT = 20;
const MAX_SCORE = 100_000;
const MAX_DISTANCE_METERS = 1_000_000_000;
const MAX_STREAK_DAYS = 10_000;
const EMPTY_PROGRESS: PlayerProgressState = {
  recentGames: [],
  dailyStreak: {
    current: 0,
    best: 0,
    lastDate: null,
  },
};

export function loadPlayerProgress(): PlayerProgressState {
  if (typeof window === "undefined") {
    return EMPTY_PROGRESS;
  }

  const raw = readStoredProgress();
  if (!raw) {
    return EMPTY_PROGRESS;
  }

  try {
    return normalizeProgress(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function recordCompletedSoloMatch(match: ApiMatch): PlayerProgressState {
  const current = loadPlayerProgress();
  const summary = createCompletedGameSummary(match);
  const recentGames = [
    summary,
    ...current.recentGames.filter((game) => game.id !== summary.id),
  ].slice(0, MAX_RECENT_GAMES);
  const nextState: PlayerProgressState = {
    recentGames,
    dailyStreak:
      match.roomCode === "DAILY"
        ? advanceDailyStreak(current.dailyStreak, getDailyChallengeDate(match))
        : current.dailyStreak,
  };

  writeStoredProgress(nextState);
  return nextState;
}

export function getRecentGame(progress: PlayerProgressState) {
  return progress.recentGames[0] ?? null;
}

export function getMapMastery(
  progress: PlayerProgressState,
  mapName: string,
  difficultyMode: GameDifficultyMode,
) {
  const games = progress.recentGames.filter(
    (game) =>
      game.mapName === mapName &&
      game.difficultyMode === difficultyMode,
  );

  if (games.length === 0) {
    return null;
  }

  const bestScore = Math.max(...games.map((game) => game.totalScore));
  const averageScore = Math.round(
    games.reduce((sum, game) => sum + game.totalScore, 0) / games.length,
  );

  return {
    gamesPlayed: games.length,
    bestScore,
    averageScore,
  };
}

function createCompletedGameSummary(match: ApiMatch): CompletedGameSummary {
  const submittedResults = match.results.filter(
    (result) => result.distanceMeters !== null,
  );
  const averageDistanceMeters =
    submittedResults.length > 0
      ? submittedResults.reduce(
          (sum, result) => sum + (result.distanceMeters ?? 0),
          0,
        ) / submittedResults.length
      : null;
  const worstRoundDistanceMeters =
    submittedResults.length > 0
      ? Math.max(...submittedResults.map((result) => result.distanceMeters ?? 0))
      : null;

  return {
    id: match.matchId,
    completedAt: new Date().toISOString(),
    mapId: match.mapId,
    mapName: match.mapName,
    difficultyMode: match.difficultyMode,
    totalScore: match.totalScore,
    averageDistanceMeters,
    bestRoundScore: Math.max(0, ...match.results.map((result) => result.score)),
    worstRoundDistanceMeters,
    roundCount: match.roundCount,
    mode: match.roomCode === "DAILY" ? "daily" : "solo",
  };
}

function advanceDailyStreak(streak: DailyStreak, koreaDate: string): DailyStreak {
  if (streak.lastDate === koreaDate) {
    return streak;
  }

  const yesterday = getRelativeKoreaDate(-1, koreaDate);
  const current = streak.lastDate === yesterday ? streak.current + 1 : 1;

  return {
    current,
    best: Math.max(streak.best, current),
    lastDate: koreaDate,
  };
}

function normalizeProgress(value: unknown): PlayerProgressState {
  if (!value || typeof value !== "object") {
    return EMPTY_PROGRESS;
  }

  const progress = value as Partial<PlayerProgressState>;
  return {
    recentGames: Array.isArray(progress.recentGames)
      ? progress.recentGames.filter(isCompletedGameSummary).slice(0, MAX_RECENT_GAMES)
      : [],
    dailyStreak: isDailyStreak(progress.dailyStreak)
      ? progress.dailyStreak
      : EMPTY_PROGRESS.dailyStreak,
  };
}

function isCompletedGameSummary(value: unknown): value is CompletedGameSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const game = value as Partial<CompletedGameSummary>;
  const roundCount = game.roundCount;
  return (
    typeof game.id === "string" &&
    typeof game.completedAt === "string" &&
    typeof game.mapId === "string" &&
    typeof game.mapName === "string" &&
    isBoundedNonNegativeNumber(game.totalScore, MAX_SCORE) &&
    isBoundedNonNegativeNumber(game.bestRoundScore, MAX_SCORE) &&
    typeof roundCount === "number" &&
    Number.isInteger(roundCount) &&
    roundCount > 0 &&
    roundCount <= MAX_ROUND_COUNT &&
    (game.averageDistanceMeters === null ||
      isBoundedNonNegativeNumber(game.averageDistanceMeters, MAX_DISTANCE_METERS)) &&
    (game.worstRoundDistanceMeters === null ||
      isBoundedNonNegativeNumber(game.worstRoundDistanceMeters, MAX_DISTANCE_METERS)) &&
    (game.mode === "solo" || game.mode === "room" || game.mode === "daily") &&
    (game.difficultyMode === "easy" ||
      game.difficultyMode === "normal" ||
      game.difficultyMode === "hard" ||
      game.difficultyMode === "mixed")
  );
}

function isDailyStreak(value: unknown): value is DailyStreak {
  if (!value || typeof value !== "object") {
    return false;
  }

  const streak = value as Partial<DailyStreak>;
  const current = streak.current;
  const best = streak.best;
  return (
    typeof current === "number" &&
    Number.isInteger(current) &&
    current >= 0 &&
    current <= MAX_STREAK_DAYS &&
    typeof best === "number" &&
    Number.isInteger(best) &&
    best >= current &&
    best <= MAX_STREAK_DAYS &&
    (streak.lastDate === null || isKoreaDateString(streak.lastDate))
  );
}

function readStoredProgress() {
  try {
    return window.localStorage.getItem(PLAYER_PROGRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredProgress(state: PlayerProgressState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PLAYER_PROGRESS_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Private browsing, blocked storage, or quota failures should not break play.
  }
}

function isBoundedNonNegativeNumber(value: unknown, max: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max
  );
}

function isKoreaDateString(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDailyChallengeDate(match: ApiMatch) {
  const dateFromMatchId = /^static-daily-(\d{4}-\d{2}-\d{2})-/.exec(
    match.matchId,
  )?.[1];

  return dateFromMatchId ?? getKoreaDate();
}

function getKoreaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getRelativeKoreaDate(dayOffset: number, baseDate: string) {
  const date = new Date(`${baseDate}T00:00:00.000+09:00`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
