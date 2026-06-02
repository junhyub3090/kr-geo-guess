import type { GameDifficultyMode } from "../api/gameApi";

export type LocalSoloLeaderboardEntry = {
  id: string;
  nickname: string;
  totalScore: number;
  difficultyMode: GameDifficultyMode;
  mapName: string;
  completedAt: string;
};

type LocalSoloScoreInput = {
  nickname: string;
  totalScore: number;
  difficultyMode: GameDifficultyMode;
  mapName: string;
};

export const LOCAL_SOLO_LEADERBOARD_KEY = "kr-geo-guess:solo-leaderboard:v1";

const MAX_STORED_ENTRIES = 80;

export function loadLocalSoloLeaderboard(): LocalSoloLeaderboardEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_SOLO_LEADERBOARD_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isLocalSoloLeaderboardEntry).sort(compareEntries);
  } catch {
    return [];
  }
}

export function recordLocalSoloScore(
  input: LocalSoloScoreInput,
): LocalSoloLeaderboardEntry[] {
  const entry: LocalSoloLeaderboardEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: input.nickname.trim() || "게스트",
    totalScore: input.totalScore,
    difficultyMode: input.difficultyMode,
    mapName: input.mapName,
    completedAt: new Date().toISOString(),
  };
  const entries = [entry, ...loadLocalSoloLeaderboard()]
    .sort(compareEntries)
    .slice(0, MAX_STORED_ENTRIES);

  window.localStorage.setItem(LOCAL_SOLO_LEADERBOARD_KEY, JSON.stringify(entries));
  return entries;
}

export function getLocalSoloLeaderboardByDifficulty(
  entries: readonly LocalSoloLeaderboardEntry[],
  difficultyMode: GameDifficultyMode,
  limit = 5,
) {
  return entries
    .filter((entry) => entry.difficultyMode === difficultyMode)
    .sort(compareEntries)
    .slice(0, limit);
}

function compareEntries(
  left: LocalSoloLeaderboardEntry,
  right: LocalSoloLeaderboardEntry,
) {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }

  return left.completedAt.localeCompare(right.completedAt);
}

function isLocalSoloLeaderboardEntry(
  value: unknown,
): value is LocalSoloLeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<LocalSoloLeaderboardEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.nickname === "string" &&
    typeof entry.totalScore === "number" &&
    typeof entry.mapName === "string" &&
    typeof entry.completedAt === "string" &&
    (entry.difficultyMode === "easy" ||
      entry.difficultyMode === "normal" ||
      entry.difficultyMode === "hard" ||
      entry.difficultyMode === "mixed")
  );
}
