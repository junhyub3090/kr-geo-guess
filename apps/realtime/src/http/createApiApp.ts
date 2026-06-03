import {
  createDailyChallenge,
  createPublicRound,
  getMapSummariesFromCatalog,
  type LatLng,
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
  const leaderboardStore =
    options?.leaderboardStore ?? createLeaderboardStoreFromEnv();
  const store = options?.store ??
    createMatchStore({
      seedCatalog,
      now: options?.now,
      leaderboardStore,
    });
  const roomStore =
    options?.roomStore ??
    createFriendRoomStore({ seedCatalog, now: options?.now });
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

  app.get("/api/seeds", (_req: Request, res: Response) => {
    res.json({
      count: seedCatalog.length,
      seeds: seedCatalog.map((seed) => ({
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
      maps: getMapSummariesFromCatalog(seedCatalog),
    });
  });

  app.post("/api/solo-matches", (req: Request, res: Response) => {
    const match = store.createSoloMatch(
      String(req.body?.nickname ?? ""),
      typeof req.body?.mapId === "string" ? req.body.mapId : undefined,
      typeof req.body?.difficultyMode === "string"
        ? req.body.difficultyMode
        : undefined,
      req.body?.timerSeconds,
    );
    res.status(201).json(match);
  });

  app.post("/api/rooms", (req: Request, res: Response) => {
    const response = roomStore.createRoom(
      String(req.body?.nickname ?? ""),
      typeof req.body?.mapId === "string" ? req.body.mapId : undefined,
      typeof req.body?.difficultyMode === "string"
        ? req.body.difficultyMode
        : undefined,
      req.body?.timerSeconds,
    );

    res.status(201).json(response);
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

  app.post("/api/solo-matches/:matchId/next", (req: Request, res: Response) => {
    try {
      res.json(store.advanceRound(String(req.params.matchId)));
    } catch (error) {
      sendDomainError(error, res);
    }
  });

  app.get("/api/daily", (_req: Request, res: Response) => {
    const koreaDate = today();
    const challenge = createDailyChallenge(seedCatalog, koreaDate);

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

function getKoreaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
