import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LeaderboardInput } from "@kr-geo-guess/shared";

export type SharedLeaderboardStore = {
  getScores: () => LeaderboardInput[];
  addScore: (score: LeaderboardInput) => LeaderboardInput;
};

export function createMemoryLeaderboardStore(
  initialScores: readonly LeaderboardInput[] = [],
): SharedLeaderboardStore {
  const scores = [...initialScores];

  return {
    getScores: () => [...scores],
    addScore: (score) => {
      scores.push(score);
      return score;
    },
  };
}

export function createFileLeaderboardStore(filePath: string): SharedLeaderboardStore {
  return {
    getScores: () => readScores(filePath),
    addScore: (score) => {
      const scores = [...readScores(filePath), score];
      writeScores(filePath, scores);
      return score;
    },
  };
}

export function createLeaderboardStoreFromEnv(): SharedLeaderboardStore {
  const filePath = process.env.LEADERBOARD_DATA_FILE?.trim();

  return filePath
    ? createFileLeaderboardStore(filePath)
    : createMemoryLeaderboardStore();
}

function readScores(filePath: string): LeaderboardInput[] {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isLeaderboardInput);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

function writeScores(filePath: string, scores: readonly LeaderboardInput[]) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(scores, null, 2), "utf8");
}

function isLeaderboardInput(value: unknown): value is LeaderboardInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const score = value as Partial<LeaderboardInput>;

  return (
    typeof score.playerId === "string" &&
    typeof score.nickname === "string" &&
    typeof score.totalScore === "number" &&
    typeof score.totalDistanceMeters === "number" &&
    typeof score.totalTimeSeconds === "number" &&
    (score.difficultyMode === undefined ||
      score.difficultyMode === "easy" ||
      score.difficultyMode === "normal" ||
      score.difficultyMode === "hard" ||
      score.difficultyMode === "mixed") &&
    (score.mapName === undefined || typeof score.mapName === "string") &&
    (score.gameMode === undefined ||
      score.gameMode === "solo" ||
      score.gameMode === "room")
  );
}
