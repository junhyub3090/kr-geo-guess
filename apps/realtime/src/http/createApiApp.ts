import {
  createDailyChallenge,
  createPublicRound,
  getMapSummariesFromCatalog,
  normalizeNickname,
  type LatLng,
  type SeedIssueReason,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import type { Express, Request, Response } from "express";
import express from "express";
import {
  MatchConflictError,
  MatchNotFoundError,
  createMatchStore,
  type MatchStore,
} from "./matchStore.js";
import {
  createLeaderboardStoreFromEnv,
  type SharedLeaderboardStore,
} from "./leaderboardStore.js";
import {
  createSeedIssueStoreFromEnv,
  type RuntimeSeedIssueInput,
  type SharedSeedIssueStore,
} from "./seedIssueStore.js";
import {
  createFeedbackStoreFromEnv,
  type FeedbackStore,
} from "./feedbackStore.js";
import {
  RoomConflictError,
  RoomNotFoundError,
  createFriendRoomStore,
  type FriendRoomStore,
} from "./roomStore.js";
import { loadRuntimeSeedCatalog } from "./seedCatalog.js";

type ApiAppOptions = {
  store?: MatchStore;
  roomStore?: FriendRoomStore;
  leaderboardStore?: SharedLeaderboardStore;
  feedbackStore?: FeedbackStore;
  seedIssueStore?: SharedSeedIssueStore;
  seedCatalog?: readonly SeedLocation[];
  allowedOrigins?: readonly string[];
  now?: () => number;
  today?: () => string;
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://junhyub3090.github.io",
];

export function createApiApp(options?: ApiAppOptions): Express {
  const app = express();
  const seedCatalog = options?.seedCatalog ?? loadRuntimeSeedCatalog();
  const seedIssueStore =
    options?.seedIssueStore ?? createSeedIssueStoreFromEnv();
  const excludedSeedIds = new Set(
    seedIssueStore.getIssues().map((issue) => issue.seedId),
  );
  const leaderboardStore =
    options?.leaderboardStore ?? createLeaderboardStoreFromEnv();
  const feedbackStore = options?.feedbackStore ?? createFeedbackStoreFromEnv();
  const store = options?.store ??
    createMatchStore({
      seedCatalog,
      now: options?.now,
      leaderboardStore,
      excludedSeedIds,
      seedIssueStore,
    });
  const roomStore =
    options?.roomStore ??
    createFriendRoomStore({
      seedCatalog,
      now: options?.now,
      leaderboardStore,
      excludedSeedIds,
      seedIssueStore,
    });
  const now = options?.now ?? Date.now;
  const today = options?.today ?? getKoreaDate;
  const allowedOrigins = options?.allowedOrigins ?? getAllowedOriginsFromEnv();

  app.use(createCorsMiddleware(allowedOrigins));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "kr-geo-guess-realtime",
    });
  });

  app.post("/api/feedback", (req: Request, res: Response) => {
    const message = normalizeOptionalString(req.body?.message, 1_200);
    if (!message) {
      res.status(400).json({ error: "Feedback message is required" });
      return;
    }

    const feedback = feedbackStore.addFeedback({
      nickname: normalizeNickname(String(req.body?.nickname ?? "")),
      message,
      pagePath: normalizeOptionalString(req.body?.pagePath, 300),
      userAgent: normalizeOptionalString(req.body?.userAgent, 300),
      createdAt: new Date(now()).toISOString(),
    });

    res.status(201).json({ feedback });
  });

  app.get("/api/seeds", (_req: Request, res: Response) => {
    const activeSeedCatalog = getActiveSeedCatalog(seedCatalog, excludedSeedIds);

    res.json({
      count: activeSeedCatalog.length,
      seeds: activeSeedCatalog.map((seed) => ({
        id: seed.id,
        region1: seed.region1,
        region2: seed.region2,
        tags: seed.tags,
        difficulty: seed.difficulty,
        sourceType: seed.sourceType,
      })),
    });
  });

  app.get("/api/maps", (_req: Request, res: Response) => {
    res.json({
      maps: getMapSummariesFromCatalog(
        getActiveSeedCatalog(seedCatalog, excludedSeedIds),
      ),
    });
  });

  app.get("/api/seed-issues/summary", (_req: Request, res: Response) => {
    res.json(createSeedIssueSummary(seedIssueStore.getIssues()));
  });

  app.post("/api/solo-matches", (req: Request, res: Response) => {
    try {
      const match = store.createSoloMatch(
        String(req.body?.nickname ?? ""),
        typeof req.body?.mapId === "string" ? req.body.mapId : undefined,
        typeof req.body?.difficultyMode === "string"
          ? req.body.difficultyMode
          : undefined,
        req.body?.timerSeconds,
      );
      res.status(201).json(match);
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms", (req: Request, res: Response) => {
    try {
      const response = roomStore.createRoom(
        String(req.body?.nickname ?? ""),
        typeof req.body?.mapId === "string" ? req.body.mapId : undefined,
        typeof req.body?.difficultyMode === "string"
          ? req.body.difficultyMode
          : undefined,
        req.body?.timerSeconds,
      );

      res.status(201).json(response);
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/join", (req: Request, res: Response) => {
    try {
      res.json(
        roomStore.joinRoom(
          String(req.params.roomCode),
          String(req.body?.nickname ?? ""),
        ),
      );
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.get("/api/rooms/:roomCode", (req: Request, res: Response) => {
    try {
      res.json({ room: roomStore.getRoom(String(req.params.roomCode)) });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/color", (req: Request, res: Response) => {
    try {
      res.json({
        room: roomStore.setPlayerColor(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
          req.body?.color,
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/start", (req: Request, res: Response) => {
    try {
      res.json({
        room: roomStore.startRoom(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/seed-issues", (req: Request, res: Response) => {
    try {
      const roundIndex = Number(req.body?.roundIndex);
      const seedId = typeof req.body?.seedId === "string" ? req.body.seedId : "";
      const reason = parseSeedIssueReason(req.body?.reason);

      if (!Number.isInteger(roundIndex) || !seedId || reason === null) {
        res.status(400).json({ error: "Invalid seed issue payload" });
        return;
      }

      res.json({
        room: roomStore.reportSeedIssue(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
          roundIndex,
          seedId,
          reason,
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/guess", (req: Request, res: Response) => {
    try {
      const roundIndex = Number(req.body?.roundIndex);
      const guess = req.body?.guess as LatLng | null | undefined;

      if (!Number.isInteger(roundIndex) || guess === undefined) {
        res.status(400).json({ error: "Invalid guess payload" });
        return;
      }

      res.json({
        room: roomStore.submitGuess(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
          roundIndex,
          guess,
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/reveal", (req: Request, res: Response) => {
    try {
      res.json({
        room: roomStore.reveal(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/next", (req: Request, res: Response) => {
    try {
      res.json({
        room: roomStore.nextRound(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/rooms/:roomCode/leave", (req: Request, res: Response) => {
    try {
      res.json({
        room: roomStore.leaveRoom(
          String(req.params.roomCode),
          String(req.body?.playerId ?? ""),
        ),
      });
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.get("/api/solo-matches/:matchId", (req: Request, res: Response) => {
    try {
      res.json(store.getSoloMatch(String(req.params.matchId)));
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/solo-matches/:matchId/guess", (req: Request, res: Response) => {
    try {
      const roundIndex = Number(req.body?.roundIndex);
      const guess = req.body?.guess as LatLng | null | undefined;

      if (!Number.isInteger(roundIndex) || guess === undefined) {
        res.status(400).json({ error: "Invalid guess payload" });
        return;
      }

      res.json(store.submitGuess(String(req.params.matchId), roundIndex, guess));
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/solo-matches/:matchId/seed-issues", (req: Request, res: Response) => {
    try {
      const roundIndex = Number(req.body?.roundIndex);
      const seedId = typeof req.body?.seedId === "string" ? req.body.seedId : "";
      const reason = parseSeedIssueReason(req.body?.reason);

      if (!Number.isInteger(roundIndex) || !seedId || reason === null) {
        res.status(400).json({ error: "Invalid seed issue payload" });
        return;
      }

      res.json(
        store.reportSeedIssue(
          String(req.params.matchId),
          roundIndex,
          seedId,
          reason,
        ),
      );
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.post("/api/solo-matches/:matchId/next", (req: Request, res: Response) => {
    try {
      res.json(store.advanceRound(String(req.params.matchId)));
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.get("/api/daily", (_req: Request, res: Response) => {
    const koreaDate = today();
    const challenge = createDailyChallenge(
      getActiveSeedCatalog(seedCatalog, excludedSeedIds),
      koreaDate,
    );

    res.json({
      id: challenge.id,
      date: koreaDate,
      roundCount: challenge.rounds.length,
      timerSeconds: challenge.timerSeconds,
      rounds: challenge.rounds.map((round) =>
        createPublicRound(round.seed, round.roundNumber, null, {
          id: challenge.mapId,
          name: challenge.mapName,
        }),
      ),
    });
  });

  app.get("/api/leaderboard", (_req: Request, res: Response) => {
    res.json({
      entries: store.getLeaderboard().slice(0, 10),
    });
  });

  app.post("/api/leaderboard", (req: Request, res: Response) => {
    const totalScore = parseNonNegativeNumber(req.body?.totalScore);
    const totalDistanceMeters = parseNonNegativeNumber(
      req.body?.totalDistanceMeters,
    );
    const totalTimeSeconds = parseNonNegativeNumber(req.body?.totalTimeSeconds);
    const difficultyMode = parseDifficultyMode(req.body?.difficultyMode);
    const mapName = typeof req.body?.mapName === "string" ? req.body.mapName : "";

    if (
      totalScore === null ||
      totalDistanceMeters === null ||
      totalTimeSeconds === null ||
      difficultyMode === null
    ) {
      res.status(400).json({ error: "Invalid leaderboard payload" });
      return;
    }

    const entry = store.recordLeaderboardScore({
      nickname: String(req.body?.nickname ?? ""),
      totalScore,
      totalDistanceMeters,
      totalTimeSeconds,
      difficultyMode,
      mapName,
    });

    res.status(201).json({
      entry,
      entries: store.getLeaderboard().slice(0, 10),
    });
  });

  return app;
}

function createCorsMiddleware(allowedOrigins: readonly string[]) {
  const allowedOriginSet = new Set(allowedOrigins);

  return (req: Request, res: Response, next: () => void) => {
    const origin = req.headers.origin;

    if (origin && allowedOriginSet.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}

function getAllowedOriginsFromEnv() {
  const configuredOrigins = [
    process.env.WEB_ORIGIN,
    process.env.WEB_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return [...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins];
}

function sendDomainError(error: unknown, res: Response) {
  if (error instanceof MatchNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof MatchConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }

  if (error instanceof RoomNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof RoomConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }

  if (error instanceof Error && error.message.includes("Korea bounds")) {
    res.status(400).json({ error: error.message });
    return;
  }

  throw error;
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parseNonNegativeNumber(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue);
}

function parseDifficultyMode(value: unknown) {
  if (
    value === "easy" ||
    value === "normal" ||
    value === "hard" ||
    value === "mixed"
  ) {
    return value;
  }

  return null;
}

function parseSeedIssueReason(value: unknown): SeedIssueReason | null {
  if (value === "no_pano" || value === "region_mismatch") {
    return value;
  }

  return null;
}

function getActiveSeedCatalog(
  seedCatalog: readonly SeedLocation[],
  excludedSeedIds: Set<string>,
) {
  return seedCatalog.filter((seed) => !excludedSeedIds.has(seed.id));
}

function createSeedIssueSummary(issues: readonly RuntimeSeedIssueInput[]) {
  const byReason = countByReason(issues);
  const byMap = [...groupByMap(issues).values()]
    .map((mapIssues) => {
      const firstIssue = mapIssues[0]!;

      return {
        mapId: firstIssue.mapId,
        mapName: firstIssue.mapName,
        count: mapIssues.length,
        byReason: countByReason(mapIssues),
      };
    })
    .sort((left, right) => right.count - left.count || left.mapName.localeCompare(right.mapName));

  return {
    total: issues.length,
    byReason,
    byMap,
  };
}

function countByReason(issues: readonly RuntimeSeedIssueInput[]) {
  const counts = new Map<SeedIssueReason, number>();

  for (const issue of issues) {
    counts.set(issue.reason, (counts.get(issue.reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function groupByMap(issues: readonly RuntimeSeedIssueInput[]) {
  const groups = new Map<string, RuntimeSeedIssueInput[]>();

  for (const issue of issues) {
    const key = `${issue.mapId}:${issue.mapName}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(issue);
    } else {
      groups.set(key, [issue]);
    }
  }

  return groups;
}

function getKoreaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
