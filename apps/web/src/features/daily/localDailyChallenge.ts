import type { ApiMatch } from "../api/gameApi";

export type DailyAttemptInfo = {
  date: string;
  official: boolean;
  attemptNumber: number;
};

export type DailyChallengeStatus = {
  date: string;
  officialStarted: boolean;
  officialCompleted: boolean;
  officialScore: number | null;
  attemptsStarted: number;
  attemptsCompleted: number;
};

export type DailyAttemptCompletionResult = {
  status: DailyChallengeStatus;
  officialRecorded: boolean;
};

type StoredDailyAttempt = {
  officialMatchId?: string;
  officialCompletedAt?: string;
  officialScore?: number;
  attemptsStarted: number;
  attemptsCompleted: number;
};

type StoredDailyAttempts = Record<string, StoredDailyAttempt>;

export const DAILY_ATTEMPTS_STORAGE_KEY = "kr-geo-guess:daily-attempts:v1";

export function getDailyChallengeStatus(
  date = getKoreaDate(),
): DailyChallengeStatus {
  return toStatus(date, readDailyAttempts()[date]);
}

export function prepareDailyAttempt(date = getKoreaDate()): DailyAttemptInfo {
  const attempts = readDailyAttempts();
  const current = normalizeAttempt(attempts[date]);

  return {
    date,
    official: !current.officialCompletedAt,
    attemptNumber: current.attemptsStarted + 1,
  };
}

export function recordDailyAttemptStart({
  date,
}: {
  date: string;
}): DailyChallengeStatus {
  const attempts = readDailyAttempts();
  const current = normalizeAttempt(attempts[date]);
  const next: StoredDailyAttempt = {
    ...current,
    attemptsStarted: current.attemptsStarted + 1,
  };

  attempts[date] = next;
  writeDailyAttempts(attempts);
  return toStatus(date, next);
}

export function recordDailyAttemptCompletion(
  match: ApiMatch,
): DailyAttemptCompletionResult {
  const date = match.daily?.date ?? getKoreaDate();
  const attempts = readDailyAttempts();
  const current = normalizeAttempt(attempts[date]);
  const officialRecorded = Boolean(match.daily && !current.officialCompletedAt);
  const next: StoredDailyAttempt = {
    ...current,
    attemptsCompleted: current.attemptsCompleted + 1,
  };

  if (officialRecorded) {
    next.officialMatchId = match.matchId;
    next.officialCompletedAt = new Date().toISOString();
    next.officialScore = match.totalScore;
  }

  attempts[date] = next;
  writeDailyAttempts(attempts);
  return {
    status: toStatus(date, next),
    officialRecorded,
  };
}

function readDailyAttempts(): StoredDailyAttempts {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DAILY_ATTEMPTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const attempts: StoredDailyAttempts = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (isKoreaDateString(date)) {
        attempts[date] = normalizeAttempt(value);
      }
    }

    return attempts;
  } catch {
    return {};
  }
}

function writeDailyAttempts(attempts: StoredDailyAttempts) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DAILY_ATTEMPTS_STORAGE_KEY,
      JSON.stringify(attempts),
    );
  } catch {
    // Storage is a local fairness aid only; play must continue without it.
  }
}

function normalizeAttempt(value: unknown): StoredDailyAttempt {
  if (!value || typeof value !== "object") {
    return {
      attemptsStarted: 0,
      attemptsCompleted: 0,
    };
  }

  const attempt = value as Partial<StoredDailyAttempt>;
  return {
    officialMatchId:
      typeof attempt.officialMatchId === "string"
        ? attempt.officialMatchId
        : undefined,
    officialCompletedAt:
      typeof attempt.officialCompletedAt === "string"
        ? attempt.officialCompletedAt
        : undefined,
    officialScore:
      typeof attempt.officialScore === "number" &&
      Number.isFinite(attempt.officialScore) &&
      attempt.officialScore >= 0
        ? attempt.officialScore
        : undefined,
    attemptsStarted: getBoundedInteger(attempt.attemptsStarted),
    attemptsCompleted: getBoundedInteger(attempt.attemptsCompleted),
  };
}

function toStatus(
  date: string,
  attempt: StoredDailyAttempt | undefined,
): DailyChallengeStatus {
  const normalized = normalizeAttempt(attempt);

  return {
    date,
    officialStarted:
      normalized.attemptsStarted > normalized.attemptsCompleted &&
      !normalized.officialCompletedAt,
    officialCompleted: Boolean(normalized.officialCompletedAt),
    officialScore: normalized.officialScore ?? null,
    attemptsStarted: normalized.attemptsStarted,
    attemptsCompleted: normalized.attemptsCompleted,
  };
}

function getBoundedInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 1_000
    ? value
    : 0;
}

function isKoreaDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getKoreaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
