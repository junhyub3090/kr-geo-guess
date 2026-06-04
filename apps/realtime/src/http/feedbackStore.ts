import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type FeedbackReport = {
  id: string;
  nickname: string;
  message: string;
  pagePath: string;
  userAgent: string;
  createdAt: string;
};

export type FeedbackReportInput = Omit<FeedbackReport, "id">;

export type FeedbackStore = {
  getFeedback: () => FeedbackReport[];
  addFeedback: (feedback: FeedbackReportInput) => FeedbackReport;
};

export function createMemoryFeedbackStore(
  initialFeedback: readonly FeedbackReport[] = [],
): FeedbackStore {
  const feedback = [...initialFeedback];
  let sequence = feedback.length;

  return {
    getFeedback: () => [...feedback],
    addFeedback: (report) => {
      sequence += 1;
      const stored = {
        id: `feedback-memory-${sequence.toString(36)}`,
        ...report,
      };
      feedback.push(stored);
      return stored;
    },
  };
}

export function createFileFeedbackStore(filePath: string): FeedbackStore {
  return {
    getFeedback: () => readFeedback(filePath),
    addFeedback: (report) => {
      const feedback = readFeedback(filePath);
      const stored = {
        id: `feedback-${Date.now().toString(36)}-${(feedback.length + 1).toString(36)}`,
        ...report,
      };
      writeFeedback(filePath, [...feedback, stored]);
      return stored;
    },
  };
}

export function createFeedbackStoreFromEnv(): FeedbackStore {
  const explicitFilePath = process.env.FEEDBACK_DATA_FILE?.trim();
  const leaderboardFilePath = process.env.LEADERBOARD_DATA_FILE?.trim();
  const derivedFilePath = leaderboardFilePath
    ? join(dirname(leaderboardFilePath), "feedback.json")
    : "";

  return explicitFilePath
    ? createFileFeedbackStore(explicitFilePath)
    : derivedFilePath
      ? createFileFeedbackStore(derivedFilePath)
      : createMemoryFeedbackStore();
}

function readFeedback(filePath: string): FeedbackReport[] {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const reports =
      Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "feedback" in parsed
          ? (parsed as { feedback?: unknown }).feedback
          : [];

    return Array.isArray(reports) ? reports.filter(isFeedbackReport) : [];
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

function writeFeedback(filePath: string, feedback: readonly FeedbackReport[]) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), feedback }, null, 2)}\n`,
    "utf8",
  );
}

function isFeedbackReport(value: unknown): value is FeedbackReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<FeedbackReport>;
  return (
    typeof report.id === "string" &&
    typeof report.nickname === "string" &&
    typeof report.message === "string" &&
    typeof report.pagePath === "string" &&
    typeof report.userAgent === "string" &&
    typeof report.createdAt === "string"
  );
}
