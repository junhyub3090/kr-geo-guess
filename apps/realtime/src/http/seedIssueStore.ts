import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SeedDifficulty, SeedIssueReason } from "@kr-geo-guess/shared";

export type RuntimeSeedIssueSource = "solo" | "room";

export type RuntimeSeedIssueInput = {
  seedId: string;
  reason: SeedIssueReason;
  source: RuntimeSeedIssueSource;
  sourceId: string;
  playerId?: string;
  mapId: string;
  mapName: string;
  roundNumber: number;
  region1: string;
  region2: string;
  difficulty: SeedDifficulty;
  reportedAt: string;
};

export type SharedSeedIssueStore = {
  getIssues: () => RuntimeSeedIssueInput[];
  addIssue: (issue: RuntimeSeedIssueInput) => RuntimeSeedIssueInput;
};

export function createMemorySeedIssueStore(
  initialIssues: readonly RuntimeSeedIssueInput[] = [],
): SharedSeedIssueStore {
  const issues = [...initialIssues];

  return {
    getIssues: () => [...issues],
    addIssue: (issue) => {
      issues.push(issue);
      return issue;
    },
  };
}

export function createFileSeedIssueStore(filePath: string): SharedSeedIssueStore {
  return {
    getIssues: () => readIssues(filePath),
    addIssue: (issue) => {
      const issues = [...readIssues(filePath), issue];
      writeIssues(filePath, issues);
      return issue;
    },
  };
}

export function createSeedIssueStoreFromEnv(): SharedSeedIssueStore {
  const explicitFilePath = process.env.SEED_ISSUE_DATA_FILE?.trim();
  const leaderboardFilePath = process.env.LEADERBOARD_DATA_FILE?.trim();
  const derivedFilePath = leaderboardFilePath
    ? join(dirname(leaderboardFilePath), "seed-issues.json")
    : "";
  const filePath = explicitFilePath || derivedFilePath;

  return filePath ? createFileSeedIssueStore(filePath) : createMemorySeedIssueStore();
}

function readIssues(filePath: string): RuntimeSeedIssueInput[] {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "issues" in parsed
        ? (parsed as { issues?: unknown }).issues
        : [];

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.filter(isRuntimeSeedIssueInput);
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

function writeIssues(
  filePath: string,
  issues: readonly RuntimeSeedIssueInput[],
) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), issues }, null, 2)}\n`,
    "utf8",
  );
}

function isRuntimeSeedIssueInput(
  value: unknown,
): value is RuntimeSeedIssueInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const issue = value as Partial<RuntimeSeedIssueInput>;

  return (
    typeof issue.seedId === "string" &&
    (issue.reason === "no_pano" || issue.reason === "region_mismatch") &&
    (issue.source === "solo" || issue.source === "room") &&
    typeof issue.sourceId === "string" &&
    typeof issue.mapId === "string" &&
    typeof issue.mapName === "string" &&
    typeof issue.roundNumber === "number" &&
    typeof issue.region1 === "string" &&
    typeof issue.region2 === "string" &&
    (issue.difficulty === "easy" ||
      issue.difficulty === "medium" ||
      issue.difficulty === "hard") &&
    typeof issue.reportedAt === "string"
  );
}
