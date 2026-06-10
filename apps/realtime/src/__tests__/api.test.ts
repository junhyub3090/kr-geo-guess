import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, test } from "vitest";
import {
  KOREA_SEED_CATALOG,
  ROOM_PLAYER_COLORS,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import { createApiApp } from "../http/createApiApp.js";
import { createFileFeedbackStore } from "../http/feedbackStore.js";
import { createFileLeaderboardStore } from "../http/leaderboardStore.js";
import {
  createFileSeedIssueStore,
  createMemorySeedIssueStore,
} from "../http/seedIssueStore.js";

describe("Node.js game API", () => {
  test("serves health and seed metadata without provider-derived data", async () => {
    const app = createApiApp();

    const health = await request(app).get("/health").expect(200);
    expect(health.body).toEqual({
      ok: true,
      service: "kr-geo-guess-realtime",
    });

    const seeds = await request(app).get("/api/seeds").expect(200);
    expect(seeds.body.count).toBeGreaterThanOrEqual(5);
    expect(seeds.body.seeds[0]).not.toHaveProperty("panoId");
    expect(seeds.body.seeds[0]).not.toHaveProperty("providerCoordinate");

    const maps = await request(app).get("/api/maps").expect(200);
    expect(maps.body.maps.find((gameMap: { id: string }) => gameMap.id === "kr-all"))
      .toHaveProperty("seedCount");
    expect(maps.body.maps.find((gameMap: { id: string }) => gameMap.id === "kr-all"))
      .toHaveProperty("playable", true);
    expect(maps.body.maps.find((gameMap: { id: string }) => gameMap.id === "kr-all"))
      .toHaveProperty("minimumSeedCount", 5);
  });

  test("serves an aggregate seed issue summary without raw player data", async () => {
    const seedIssueStore = createMemorySeedIssueStore([
      {
        seedId: "seoul-seed-1",
        reason: "no_pano",
        source: "solo",
        sourceId: "solo-1",
        mapId: "seoul",
        mapName: "서울",
        roundNumber: 1,
        region1: "서울",
        region2: "중구",
        difficulty: "medium",
        reportedAt: "2026-06-10T00:00:00.000Z",
      },
      {
        seedId: "seoul-seed-2",
        reason: "region_mismatch",
        source: "room",
        sourceId: "KR-4821",
        playerId: "player-secret",
        mapId: "seoul",
        mapName: "서울",
        roundNumber: 2,
        region1: "서울",
        region2: "마포구",
        difficulty: "hard",
        reportedAt: "2026-06-10T00:01:00.000Z",
      },
      {
        seedId: "jeju-seed-1",
        reason: "no_pano",
        source: "room",
        sourceId: "KR-7788",
        playerId: "player-hidden",
        mapId: "jeju",
        mapName: "제주도",
        roundNumber: 1,
        region1: "제주",
        region2: "제주시",
        difficulty: "easy",
        reportedAt: "2026-06-10T00:02:00.000Z",
      },
    ]);
    const app = createApiApp({ seedIssueStore });

    const response = await request(app)
      .get("/api/seed-issues/summary")
      .expect(200);

    expect(response.body).toEqual({
      total: 3,
      byReason: [
        { reason: "no_pano", count: 2 },
        { reason: "region_mismatch", count: 1 },
      ],
      byMap: [
        {
          mapId: "seoul",
          mapName: "서울",
          count: 2,
          byReason: [
            { reason: "no_pano", count: 1 },
            { reason: "region_mismatch", count: 1 },
          ],
        },
        {
          mapId: "jeju",
          mapName: "제주도",
          count: 1,
          byReason: [{ reason: "no_pano", count: 1 }],
        },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain("player-secret");
    expect(JSON.stringify(response.body)).not.toContain("player-hidden");
  });

  test("serves an authenticated seed issue triage list without raw identifiers", async () => {
    const seedIssueStore = createMemorySeedIssueStore([
      {
        seedId: "seoul-seed-2",
        reason: "region_mismatch",
        source: "room",
        sourceId: "KR-4821",
        playerId: "player-secret",
        mapId: "seoul",
        mapName: "서울",
        roundNumber: 2,
        region1: "서울",
        region2: "마포구",
        difficulty: "hard",
        reportedAt: "2026-06-10T00:01:00.000Z",
      },
      {
        seedId: "jeju-seed-1",
        reason: "no_pano",
        source: "solo",
        sourceId: "solo-1",
        playerId: "player-hidden",
        mapId: "jeju",
        mapName: "제주도",
        roundNumber: 1,
        region1: "제주",
        region2: "제주시",
        difficulty: "easy",
        reportedAt: "2026-06-10T00:02:00.000Z",
      },
    ]);
    const closedApp = createApiApp({ seedIssueStore });
    await request(closedApp)
      .get("/api/seed-issues")
      .expect(404);

    const app = createApiApp({
      seedIssueStore,
      seedIssueAdminToken: "secret-token",
    });

    await request(app)
      .get("/api/seed-issues")
      .expect(403);

    await request(app)
      .get("/api/seed-issues")
      .set("Authorization", "Bearer wrong-token")
      .expect(403);

    const response = await request(app)
      .get("/api/seed-issues")
      .set("Authorization", "Bearer secret-token")
      .expect(200);

    expect(response.body.issues).toEqual([
      {
        seedId: "jeju-seed-1",
        reason: "no_pano",
        source: "solo",
        mapId: "jeju",
        mapName: "제주도",
        roundNumber: 1,
        region1: "제주",
        region2: "제주시",
        difficulty: "easy",
        reportedAt: "2026-06-10T00:02:00.000Z",
      },
      {
        seedId: "seoul-seed-2",
        reason: "region_mismatch",
        source: "room",
        mapId: "seoul",
        mapName: "서울",
        roundNumber: 2,
        region1: "서울",
        region2: "마포구",
        difficulty: "hard",
        reportedAt: "2026-06-10T00:01:00.000Z",
      },
    ]);
    expect(response.body.total).toBe(2);
    expect(JSON.stringify(response.body)).not.toContain("KR-4821");
    expect(JSON.stringify(response.body)).not.toContain("solo-1");
    expect(JSON.stringify(response.body)).not.toContain("player-secret");
    expect(JSON.stringify(response.body)).not.toContain("player-hidden");
  });

  test("allows configured browser origins for deployed web clients", async () => {
    const origin = "https://junhyub3090.github.io";
    const app = createApiApp({ allowedOrigins: [origin] });

    await request(app)
      .options("/api/solo-matches")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .expect(204)
      .expect("Access-Control-Allow-Origin", origin)
      .expect("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
      .expect("Vary", "Origin");

    const maps = await request(app)
      .get("/api/maps")
      .set("Origin", origin)
      .expect(200);

    expect(maps.headers["access-control-allow-origin"]).toBe(origin);
  });

  test("creates a solo match with a public first round for the roadview viewer", async () => {
    const app = createApiApp();

    const response = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "  지훈  ", mapId: "seoul", difficultyMode: "hard" })
      .expect(201);

    expect(response.body.player.nickname).toBe("지훈");
    expect(response.body.mapId).toBe("seoul");
    expect(response.body.difficultyMode).toBe("hard");
    expect(response.body.timerSeconds).toBe(30);
    expect(response.body.roomCode).toMatch(/^KR-[A-Z0-9]{4}$/);
    expect(response.body.currentRound.roundNumber).toBe(1);
    expect(response.body.currentRound.regionHint).toBe("서울");
    expect(response.body.currentRound.roadviewTarget).toEqual(
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
    );
    expect(response.body.results).toEqual([]);
  });

  test("accepts a timed-out solo round without a pin as zero points", async () => {
    const app = createApiApp({ seedCatalog: KOREA_SEED_CATALOG });
    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "미제출", mapId: "seoul" })
      .expect(201);

    const guess = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: null,
      })
      .expect(200);

    expect(guess.body.result.score).toBe(0);
    expect(guess.body.result.distanceMeters).toBeNull();
    expect(guess.body.result.guess).toBeNull();
    expect(guess.body.totalScore).toBe(0);
  });

  test("creates province matches from only that province and scores with province scope", async () => {
    const app = createApiApp({ seedCatalog: createRuntimeSeedFixture() });

    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "전남", mapId: "jeonnam", difficultyMode: "mixed" })
      .expect(201);

    expect(created.body.mapName).toBe("전라남도");
    expect(created.body.currentRound.regionHint).toBe("전남");

    const target = created.body.currentRound.roadviewTarget;
    const guessed = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: { lat: target.lat + 0.27, lng: target.lng },
      })
      .expect(200);

    expect(guessed.body.result.target.region1).toBe("전남");
    expect(guessed.body.result.score).toBeLessThan(2500);
  });

  test("accepts a valid guess, reveals target, and advances rounds", async () => {
    const app = createApiApp({ seedCatalog: KOREA_SEED_CATALOG });
    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "민서" })
      .expect(201);
    const firstTarget = KOREA_SEED_CATALOG.find(
      (seed) => seed.id === created.body.currentRound.seedId,
    );
    expect(firstTarget).toBeDefined();

    const guess = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: { lat: firstTarget!.lat + 0.001, lng: firstTarget!.lng + 0.001 },
      })
      .expect(200);

    expect(guess.body.result.score).toBeGreaterThan(4900);
    expect(guess.body.result.target.id).toBe(firstTarget!.id);

    const next = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/next`)
      .send({})
      .expect(200);

    expect(next.body.currentRound.roundNumber).toBe(2);
    expect(next.body.phase).toBe("active");
  });

  test("rejects outside-Korea guesses and duplicate round submissions", async () => {
    const app = createApiApp();
    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "하린" })
      .expect(201);

    await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: { lat: 40.7, lng: -74.0 },
      })
      .expect(400);

    await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: { lat: 37.565, lng: 126.98 },
      })
      .expect(200);

    await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: { lat: 37.565, lng: 126.98 },
      })
      .expect(409);
  });

  test("serves stable daily challenge and leaderboard", async () => {
    const app = createApiApp({ today: () => "2026-06-01" });

    const daily = await request(app).get("/api/daily").expect(200);
    expect(daily.body.id).toBe("daily-2026-06-01");
    expect(daily.body.roundCount).toBe(5);
    expect(daily.body.timerSeconds).toBe(30);

    const leaderboard = await request(app).get("/api/leaderboard").expect(200);
    expect(leaderboard.body.entries).toEqual([]);
  });

  test("records shared solo leaderboard scores submitted by web clients", async () => {
    const app = createApiApp();

    await request(app)
      .post("/api/leaderboard")
      .send({
        nickname: "하린",
        totalScore: 23000,
        totalDistanceMeters: 1200,
        totalTimeSeconds: 43,
        difficultyMode: "hard",
        mapName: "전국",
      })
      .expect(201);

    await request(app)
      .post("/api/leaderboard")
      .send({
        nickname: "지훈",
        totalScore: 18000,
        totalDistanceMeters: 2300,
        totalTimeSeconds: 52,
        difficultyMode: "normal",
        mapName: "서울",
      })
      .expect(201);

    const leaderboard = await request(app).get("/api/leaderboard").expect(200);

    expect(leaderboard.body.entries[0].gameMode).toBe("solo");
    expect(leaderboard.body.entries[1].gameMode).toBe("solo");

    expect(leaderboard.body.entries).toEqual([
      expect.objectContaining({
        rank: 1,
        nickname: "하린",
        totalScore: 23000,
        difficultyMode: "hard",
        mapName: "전국",
      }),
      expect.objectContaining({
        rank: 2,
        nickname: "지훈",
        totalScore: 18000,
        difficultyMode: "normal",
        mapName: "서울",
      }),
    ]);
  });

  test("does not fill a selected solo map from the national pool", async () => {
    const app = createApiApp({ seedCatalog: KOREA_SEED_CATALOG });

    const response = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "경북", mapId: "gyeongbuk", difficultyMode: "mixed" })
      .expect(409);

    expect(response.body.error).toBe("플레이 가능한 위치가 부족합니다. 잠시 후 다시 시도해 주세요.");
  });

  test("creates a selected region solo match from only that runtime map pool", async () => {
    const app = createApiApp({ seedCatalog: createRuntimeSeedFixture() });

    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "경북", mapId: "gyeongbuk", difficultyMode: "mixed" })
      .expect(201);

    expect(created.body.mapId).toBe("gyeongbuk");
    expect(created.body.mapName).toBe("경상북도");
    expect(created.body.currentRound.regionHint).toBe("경북");
  });

  test("records player feedback reports for later review", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "kr-geo-guess-feedback-"));
    const feedbackFile = join(dataDir, "feedback.json");

    try {
      const feedbackStore = createFileFeedbackStore(feedbackFile);
      const app = createApiApp({
        feedbackStore,
        now: () => 1_780_000_000_000,
      });

      const response = await request(app)
        .post("/api/feedback")
        .send({
          nickname: "지훈",
          message: "친구방 입장이 안 됩니다.",
          pagePath: "/kr-geo-guess/?room=KR-4821",
          userAgent: "Playwright",
        })
        .expect(201);

      expect(response.body.feedback).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^feedback-/),
          nickname: "지훈",
          message: "친구방 입장이 안 됩니다.",
          pagePath: "/kr-geo-guess/?room=KR-4821",
          userAgent: "Playwright",
          createdAt: "2026-05-28T20:26:40.000Z",
        }),
      );

      expect(createFileFeedbackStore(feedbackFile).getFeedback()).toEqual([
        expect.objectContaining({
          nickname: "지훈",
          message: "친구방 입장이 안 됩니다.",
        }),
      ]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("rejects blank feedback reports", async () => {
    const app = createApiApp();

    await request(app)
      .post("/api/feedback")
      .send({ nickname: "지훈", message: "   " })
      .expect(400);
  });

  test("persists shared solo leaderboard scores across API app instances", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "kr-geo-guess-leaderboard-"));
    const leaderboardFile = join(dataDir, "leaderboard.json");

    try {
      const firstApp = createApiApp({
        leaderboardStore: createFileLeaderboardStore(leaderboardFile),
      });

      await request(firstApp)
        .post("/api/leaderboard")
        .send({
          nickname: "민서",
          totalScore: 24400,
          totalDistanceMeters: 940,
          totalTimeSeconds: 39,
          difficultyMode: "hard",
          mapName: "경기도",
        })
        .expect(201);

      const restartedApp = createApiApp({
        leaderboardStore: createFileLeaderboardStore(leaderboardFile),
      });
      const leaderboard = await request(restartedApp)
        .get("/api/leaderboard")
        .expect(200);

      expect(leaderboard.body.entries).toEqual([
        expect.objectContaining({
          rank: 1,
          nickname: "민서",
          totalScore: 24400,
          difficultyMode: "hard",
          mapName: "경기도",
        }),
      ]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("adds a small server-side time bonus without exceeding the round cap", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: KOREA_SEED_CATALOG,
      now: () => now,
    });
    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "타임", mapId: "seoul" })
      .expect(201);
    const target = KOREA_SEED_CATALOG.find(
      (seed) => seed.id === created.body.currentRound.seedId,
    );
    expect(target).toBeDefined();

    now += 5_000;

    const guessed = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/guess`)
      .send({
        roundIndex: 0,
        guess: { lat: target!.lat + 0.001, lng: target!.lng + 0.001 },
      })
      .expect(200);

    expect(guessed.body.result.timeRemainingSeconds).toBe(25);
    expect(guessed.body.result.timeBonus).toBeGreaterThan(0);
    expect(guessed.body.result.timeBonus).toBeLessThanOrEqual(200);
    expect(guessed.body.result.score).toBeLessThanOrEqual(5000);
    expect(guessed.body.result.score).toBe(
      guessed.body.result.distanceScore + guessed.body.result.timeBonus,
    );
  });

  test("uses the injected runtime seed catalog for maps, matches, and daily rounds", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
      today: () => "2026-06-01",
    });

    const seeds = await request(app).get("/api/seeds").expect(200);
    expect(seeds.body.count).toBe(runtimeSeeds.length);
    expect(seeds.body.seeds.every((seed: { sourceType: string }) => seed.sourceType === "osm_derived"))
      .toBe(true);

    const maps = await request(app).get("/api/maps").expect(200);
    expect(maps.body.maps.find((gameMap: { id: string }) => gameMap.id === "seoul")?.seedCount)
      .toBe(6);

    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "런타임", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);

    expect(created.body.currentRound.regionHint).toBe("서울");
    const firstRoundSeed = runtimeSeeds.find(
      (seed) => seed.id === created.body.currentRound.seedId,
    );
    expect(firstRoundSeed?.region1).toBe("서울");

    const daily = await request(app).get("/api/daily").expect(200);
    expect(daily.body.rounds).toHaveLength(5);
    expect(
      daily.body.rounds.every((round: { seedId: string }) =>
        runtimeSeeds.some((seed) => seed.id === round.seedId),
      ),
    ).toBe(true);
  });

  test("loads the runtime seed catalog by default so every map is playable", async () => {
    const app = createApiApp();

    const maps = await request(app).get("/api/maps").expect(200);
    const unplayableMaps = maps.body.maps.filter(
      (gameMap: { playable?: boolean }) => gameMap.playable === false,
    );
    const regionMaps = maps.body.maps.filter(
      (gameMap: { id: string }) => gameMap.id !== "kr-all",
    );

    expect(unplayableMaps).toHaveLength(0);
    expect(regionMaps).toHaveLength(17);
    expect(
      regionMaps.every(
        (gameMap: { seedCount: number }) => gameMap.seedCount >= 1_000,
      ),
    ).toBe(true);
    expect(
      maps.body.maps.find((gameMap: { id: string }) => gameMap.id === "gyeongbuk")
        ?.seedCount,
    ).toBe(1_000);
  });

  test("does not fill a selected friend room map from the national pool", async () => {
    const app = createApiApp({ seedCatalog: KOREA_SEED_CATALOG });

    const response = await request(app)
      .post("/api/rooms")
      .send({ nickname: "방장", mapId: "gyeongbuk", difficultyMode: "mixed" })
      .expect(409);

    expect(response.body.error).toBe("플레이 가능한 위치가 부족합니다. 잠시 후 다시 시도해 주세요.");
  });

  test("creates a selected region friend room from only that runtime map pool", async () => {
    const app = createApiApp({ seedCatalog: createRuntimeSeedFixture() });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "방장", mapId: "gyeongbuk", difficultyMode: "mixed" })
      .expect(201);

    expect(created.body.room.mapId).toBe("gyeongbuk");
    expect(created.body.room.mapName).toBe("경상북도");
    expect(created.body.room.currentRound.regionHint).toBe("경북");
  });

  test("runs a shared friend room with hidden peer pins until reveal", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    const started = await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    expect(started.body.room.currentRound.seedId).toBeDefined();
    expect(started.body.room.currentRound.roadviewTarget).toEqual(
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
    );

    const hostGuess = await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: hostId,
        roundIndex: 0,
        guess: { lat: 37.5, lng: 127.0 },
      })
      .expect(200);

    expect(hostGuess.body.room.phase).toBe("round_active");
    expect(hostGuess.body.room.revealed).toBeNull();
    expect(
      hostGuess.body.room.players.find(
        (player: { playerId: string }) => player.playerId === hostId,
      )?.hasGuessed,
    ).toBe(true);
    expect(
      hostGuess.body.room.players.filter(
        (player: { hasGuessed: boolean }) => player.hasGuessed,
      ),
    ).toHaveLength(1);

    await request(app)
      .post(`/api/rooms/${roomCode}/reveal`)
      .send({ playerId: hostId })
      .expect(409);

    const guestGuess = await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: guestId,
        roundIndex: 0,
        guess: { lat: 37.51, lng: 127.01 },
      })
      .expect(200);

    expect(guestGuess.body.room.phase).toBe("round_active");
    expect(guestGuess.body.room.revealed).toBeNull();
    expect(
      guestGuess.body.room.players.filter(
        (player: { hasGuessed: boolean }) => player.hasGuessed,
      ),
    ).toHaveLength(2);

    const countdown = await request(app)
      .post(`/api/rooms/${roomCode}/reveal`)
      .send({ playerId: hostId })
      .expect(200);

    expect(countdown.body.room.phase).toBe("round_reveal_countdown");
    expect(countdown.body.room.revealed).toBeNull();
    expect(countdown.body.room.revealCountdownEndsAt).toBe(now + 3_000);

    now += 3_000;

    const revealed = await request(app)
      .get(`/api/rooms/${roomCode}`)
      .expect(200);

    expect(revealed.body.room.phase).toBe("round_reveal");
    expect(revealed.body.room.revealed.target).toEqual(
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
    );
    expect(revealed.body.room.revealed.guesses).toHaveLength(2);
    expect(
      revealed.body.room.revealed.guesses.map(
        (guess: { playerId: string }) => guess.playerId,
      ).sort(),
    ).toEqual([guestId, hostId].sort());
    expect(revealed.body.room.revealed.guesses[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        nickname: expect.any(String),
        color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        distanceMeters: expect.any(Number),
        score: expect.any(Number),
        totalScore: expect.any(Number),
      }),
    );
    expect(revealed.body.room.roundHistory).toEqual([
      expect.objectContaining({
        roundNumber: 1,
        guesses: expect.arrayContaining([
          expect.objectContaining({ playerId: hostId, rank: expect.any(Number) }),
          expect.objectContaining({ playerId: guestId, rank: expect.any(Number) }),
        ]),
      }),
    ]);

    const next = await request(app)
      .post(`/api/rooms/${roomCode}/next`)
      .send({ playerId: hostId })
      .expect(200);

    expect(next.body.room.phase).toBe("round_active");
    expect(next.body.room.roundIndex).toBe(1);
    expect(next.body.room.currentRound.seedId).not.toBe(
      started.body.room.currentRound.seedId,
    );
  });

  test("keeps friend room timers isolated after early reveal countdown", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    const started = await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);
    const firstRoundEndsAt = now + 30_000;
    expect(started.body.room.serverTime).toBe(now);
    expect(started.body.room.currentRound.timerEndsAt).toBe(firstRoundEndsAt);

    now += 25_000;

    await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: hostId,
        roundIndex: 0,
        guess: { lat: 37.5, lng: 127.0 },
      })
      .expect(200);
    await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: guestId,
        roundIndex: 0,
        guess: { lat: 37.51, lng: 127.01 },
      })
      .expect(200);

    const countdown = await request(app)
      .post(`/api/rooms/${roomCode}/reveal`)
      .send({ playerId: hostId })
      .expect(200);

    expect(countdown.body.room.phase).toBe("round_reveal_countdown");
    expect(countdown.body.room.serverTime).toBe(now);
    expect(countdown.body.room.revealCountdownEndsAt).toBe(now + 3_000);
    expect(countdown.body.room.currentRound.timerEndsAt).toBeNull();

    now += 3_000;

    const next = await request(app)
      .post(`/api/rooms/${roomCode}/next`)
      .send({ playerId: hostId })
      .expect(200);

    expect(next.body.room.phase).toBe("round_active");
    expect(next.body.room.serverTime).toBe(now);
    expect(next.body.room.roundIndex).toBe(1);
    expect(next.body.room.currentRound.timerEndsAt).toBe(now + 30_000);
    expect(next.body.room.currentRound.timerEndsAt).not.toBe(firstRoundEndsAt);
    expect(next.body.room.roundHistory).toHaveLength(1);
  });

  test("creates a same-member rematch room that guests can join from final results", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "normal" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;
    const hostColor = created.body.room.players[0].color;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;
    const guestColor = joined.body.room.players.find(
      (player: { playerId: string }) => player.playerId === guestId,
    ).color;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    let finishedRoom = null as null | { room: { phase: string } };
    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: hostId,
          roundIndex,
          guess: { lat: 37.5, lng: 127.0 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: guestId,
          roundIndex,
          guess: { lat: 37.51, lng: 127.01 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/reveal`)
        .send({ playerId: hostId })
        .expect(200);
      now += 3_000;
      await request(app).get(`/api/rooms/${roomCode}`).expect(200);
      finishedRoom = (await request(app)
        .post(`/api/rooms/${roomCode}/next`)
        .send({ playerId: hostId })
        .expect(200)).body;
    }

    expect(finishedRoom?.room.phase).toBe("finished");

    await request(app)
      .post(`/api/rooms/${roomCode}/rematch`)
      .send({ playerId: guestId })
      .expect(409);

    const rematch = await request(app)
      .post(`/api/rooms/${roomCode}/rematch`)
      .send({ playerId: hostId })
      .expect(201);

    expect(rematch.body.room.roomCode).not.toBe(roomCode);
    expect(rematch.body.room.phase).toBe("lobby");
    expect(rematch.body.room.rematchOnly).toBe(true);
    expect(rematch.body.room.mapId).toBe("seoul");
    expect(rematch.body.room.difficultyMode).toBe("normal");
    expect(rematch.body.room.players).toEqual([
      expect.objectContaining({
        nickname: "지훈",
        connected: true,
        isHost: true,
        score: 0,
        color: hostColor,
      }),
      expect.objectContaining({
        nickname: "하린",
        connected: false,
        isHost: false,
        score: 0,
        color: guestColor,
      }),
    ]);

    const oldRoom = await request(app).get(`/api/rooms/${roomCode}`).expect(200);
    expect(oldRoom.body.room.rematchOnly).toBe(false);
    expect(oldRoom.body.room.rematch).toEqual(
      expect.objectContaining({
        roomCode: rematch.body.room.roomCode,
        mapName: "서울",
        difficultyMode: "normal",
        status: "lobby",
        joinable: true,
      }),
    );

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({ playerId: rematch.body.playerId })
      .expect(409);

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/join`)
      .send({ nickname: "민수" })
      .expect(409);

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(409);

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({ playerId: rematch.body.playerId })
      .expect(409);

    const guestRematch = await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/rematch/join`)
      .send({ playerId: guestId })
      .expect(200);

    expect(guestRematch.body.playerId).not.toBe(guestId);
    expect(guestRematch.body.room.roomCode).toBe(rematch.body.room.roomCode);
    expect(
      guestRematch.body.room.players.find(
        (player: { nickname: string }) => player.nickname === "하린",
      ),
    ).toEqual(expect.objectContaining({ connected: true, color: guestColor }));

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/leave`)
      .send({ playerId: guestRematch.body.playerId })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({ playerId: rematch.body.playerId })
      .expect(409);

    const rejoinedGuestRematch = await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/rematch/join`)
      .send({ playerId: guestId })
      .expect(200);
    expect(
      rejoinedGuestRematch.body.room.players.find(
        (player: { nickname: string }) => player.nickname === "하린",
      ),
    ).toEqual(expect.objectContaining({ connected: true, color: guestColor }));

    const startedRematch = await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({ playerId: rematch.body.playerId })
      .expect(200);
    expect(startedRematch.body.room.phase).toBe("round_active");

    const oldRoomAfterStart = await request(app)
      .get(`/api/rooms/${roomCode}`)
      .expect(200);
    expect(oldRoomAfterStart.body.room.rematch).toEqual(
      expect.objectContaining({
        roomCode: rematch.body.room.roomCode,
        status: "started",
        joinable: false,
      }),
    );

    const rematchRoomCode = rematch.body.room.roomCode;
    const rematchHostId = rematch.body.playerId;
    const rematchGuestId = rejoinedGuestRematch.body.playerId;
    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      await request(app)
        .post(`/api/rooms/${rematchRoomCode}/guess`)
        .send({
          playerId: rematchHostId,
          roundIndex,
          guess: { lat: 37.5, lng: 127.0 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${rematchRoomCode}/guess`)
        .send({
          playerId: rematchGuestId,
          roundIndex,
          guess: { lat: 37.51, lng: 127.01 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${rematchRoomCode}/reveal`)
        .send({ playerId: rematchHostId })
        .expect(200);
      now += 3_000;
      await request(app).get(`/api/rooms/${rematchRoomCode}`).expect(200);
      await request(app)
        .post(`/api/rooms/${rematchRoomCode}/next`)
        .send({ playerId: rematchHostId })
        .expect(200);
    }

    const secondRematch = await request(app)
      .post(`/api/rooms/${rematchRoomCode}/rematch`)
      .send({ playerId: rematchHostId })
      .expect(201);

    const secondGuestRematch = await request(app)
      .post(`/api/rooms/${rematchRoomCode}/rematch/join`)
      .send({ playerId: rematchGuestId })
      .expect(200);

    expect(secondGuestRematch.body.room.roomCode).toBe(
      secondRematch.body.room.roomCode,
    );
  });

  test("keeps rematch child-code joins working if the finished source room is deleted", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "normal" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: hostId,
          roundIndex,
          guess: { lat: 37.5, lng: 127.0 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: guestId,
          roundIndex,
          guess: { lat: 37.51, lng: 127.01 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/reveal`)
        .send({ playerId: hostId })
        .expect(200);
      now += 3_000;
      await request(app).get(`/api/rooms/${roomCode}`).expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/next`)
        .send({ playerId: hostId })
        .expect(200);
    }

    const rematch = await request(app)
      .post(`/api/rooms/${roomCode}/rematch`)
      .send({ playerId: hostId })
      .expect(201);
    const rematchRoomCode = rematch.body.room.roomCode;

    await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: hostId })
      .expect(200);
    await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: guestId })
      .expect(200);
    await request(app).get(`/api/rooms/${roomCode}`).expect(404);

    const guestRematch = await request(app)
      .post(`/api/rooms/${rematchRoomCode}/rematch/join`)
      .send({ playerId: guestId })
      .expect(200);

    expect(guestRematch.body.room.roomCode).toBe(rematchRoomCode);
    expect(
      guestRematch.body.room.players.find(
        (player: { nickname: string }) => player.nickname === "하린",
      ),
    ).toEqual(expect.objectContaining({ connected: true }));
  });

  test("lets hosts recover a rematch lobby with the currently connected members", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "normal" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: hostId,
          roundIndex,
          guess: { lat: 37.5, lng: 127.0 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: guestId,
          roundIndex,
          guess: { lat: 37.51, lng: 127.01 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/reveal`)
        .send({ playerId: hostId })
        .expect(200);
      now += 3_000;
      await request(app).get(`/api/rooms/${roomCode}`).expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/next`)
        .send({ playerId: hostId })
        .expect(200);
    }

    const rematch = await request(app)
      .post(`/api/rooms/${roomCode}/rematch`)
      .send({ playerId: hostId })
      .expect(201);

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({ playerId: rematch.body.playerId })
      .expect(409);

    const recovered = await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({
        playerId: rematch.body.playerId,
        allowMissingRematchPlayers: true,
      })
      .expect(200);

    expect(recovered.body.room.phase).toBe("round_active");
    expect(recovered.body.room.players).toEqual([
      expect.objectContaining({ nickname: "지훈", connected: true }),
    ]);

    await request(app)
      .post(`/api/rooms/${roomCode}/rematch/join`)
      .send({ playerId: guestId })
      .expect(409);
  });

  test("does not block rematch start on players who left the original room", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "normal" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: guestId })
      .expect(200);

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: hostId,
          roundIndex,
          guess: { lat: 37.5, lng: 127.0 },
        })
        .expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/reveal`)
        .send({ playerId: hostId })
        .expect(200);
      now += 3_000;
      await request(app).get(`/api/rooms/${roomCode}`).expect(200);
      await request(app)
        .post(`/api/rooms/${roomCode}/next`)
        .send({ playerId: hostId })
        .expect(200);
    }

    const rematch = await request(app)
      .post(`/api/rooms/${roomCode}/rematch`)
      .send({ playerId: hostId })
      .expect(201);

    expect(rematch.body.room.players).toHaveLength(1);
    expect(rematch.body.room.players[0]).toEqual(
      expect.objectContaining({ nickname: "지훈", connected: true }),
    );

    await request(app)
      .post(`/api/rooms/${rematch.body.room.roomCode}/start`)
      .send({ playerId: rematch.body.playerId })
      .expect(200);
  });

  test("resets the next friend room timer after natural timeout reveal", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    now += 30_000;

    const revealed = await request(app)
      .get(`/api/rooms/${roomCode}`)
      .expect(200);
    expect(revealed.body.room.phase).toBe("round_reveal");
    expect(revealed.body.room.serverTime).toBe(now);
    expect(revealed.body.room.currentRound.timerEndsAt).toBeNull();

    now += 2_000;

    const next = await request(app)
      .post(`/api/rooms/${roomCode}/next`)
      .send({ playerId: hostId })
      .expect(200);

    expect(next.body.room.phase).toBe("round_active");
    expect(next.body.room.serverTime).toBe(now);
    expect(next.body.room.currentRound.timerEndsAt).toBe(now + 30_000);
  });

  test("replaces an active solo round when the roadview seed is stale", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
      now: () => now,
    });

    const created = await request(app)
      .post("/api/solo-matches")
      .send({ nickname: "교체", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const staleSeedId = created.body.currentRound.seedId;

    now += 7_000;

    const replaced = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/seed-issues`)
      .send({
        roundIndex: 0,
        seedId: staleSeedId,
        reason: "no_pano",
      })
      .expect(200);

    expect(replaced.body.phase).toBe("active");
    expect(replaced.body.roundIndex).toBe(0);
    expect(replaced.body.currentRound.seedId).not.toBe(staleSeedId);
    expect(replaced.body.currentRound.timerEndsAt).toBe(now + 30_000);

    const idempotent = await request(app)
      .post(`/api/solo-matches/${created.body.matchId}/seed-issues`)
      .send({
        roundIndex: 0,
        seedId: staleSeedId,
        reason: "no_pano",
      })
      .expect(200);

    expect(idempotent.body.currentRound.seedId).toBe(
      replaced.body.currentRound.seedId,
    );
  });

  test("persists reported stale seeds so restarted API instances exclude them", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    const dataDir = mkdtempSync(join(tmpdir(), "kr-geo-guess-seed-issues-"));
    const issueFile = join(dataDir, "seed-issues.json");

    try {
      const firstApp = createApiApp({
        seedCatalog: runtimeSeeds,
        now: () => 1_780_000_000_000,
        seedIssueStore: createFileSeedIssueStore(issueFile),
      });
      const created = await request(firstApp)
        .post("/api/solo-matches")
        .send({ nickname: "교체", mapId: "seoul", difficultyMode: "mixed" })
        .expect(201);
      const staleSeedId = created.body.currentRound.seedId;

      await request(firstApp)
        .post(`/api/solo-matches/${created.body.matchId}/seed-issues`)
        .send({
          roundIndex: 0,
          seedId: staleSeedId,
          reason: "no_pano",
        })
        .expect(200);

      const restartedApp = createApiApp({
        seedCatalog: runtimeSeeds,
        now: () => 1_780_000_100_000,
        seedIssueStore: createFileSeedIssueStore(issueFile),
      });
      const restartedSeeds = await request(restartedApp)
        .get("/api/seeds")
        .expect(200);
      const restartedMatch = await request(restartedApp)
        .post("/api/solo-matches")
        .send({ nickname: "재시작", mapId: "seoul", difficultyMode: "mixed" })
        .expect(201);

      expect(
        restartedSeeds.body.seeds.some((seed: { id: string }) => seed.id === staleSeedId),
      ).toBe(false);
      expect(restartedMatch.body.currentRound.seedId).not.toBe(staleSeedId);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test("replaces an active room round for everyone and clears stale guesses", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;
    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    const started = await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);
    const staleSeedId = started.body.room.currentRound.seedId;

    await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: hostId,
        roundIndex: 0,
        guess: { lat: 37.5, lng: 127.0 },
      })
      .expect(200);

    now += 4_000;

    const replaced = await request(app)
      .post(`/api/rooms/${roomCode}/seed-issues`)
      .send({
        playerId: guestId,
        roundIndex: 0,
        seedId: staleSeedId,
        reason: "no_pano",
      })
      .expect(200);

    expect(replaced.body.room.phase).toBe("round_active");
    expect(replaced.body.room.currentRound.seedId).not.toBe(staleSeedId);
    expect(replaced.body.room.currentRound.timerEndsAt).toBe(now + 30_000);
    expect(replaced.body.room.players.every(
      (player: { hasGuessed: boolean }) => !player.hasGuessed,
    )).toBe(true);
    expect(replaced.body.room.revealed).toBeNull();
  });

  test("rejects stale seed reports from disconnected room players", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
      now: () => 1_780_000_000_000,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;
    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    const started = await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: guestId })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomCode}/seed-issues`)
      .send({
        playerId: guestId,
        roundIndex: 0,
        seedId: started.body.room.currentRound.seedId,
        reason: "no_pano",
      })
      .expect(409);
  });

  test("lets lobby players choose unique signature colors before the room starts", async () => {
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: createIncrementingClock(1_780_000_000_000),
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    expect(new Set(joined.body.room.players.map(
      (player: { color: string }) => player.color,
    )).size).toBe(2);

    const hostColor = ROOM_PLAYER_COLORS[5];
    const guestColor = ROOM_PLAYER_COLORS[6];

    const changed = await request(app)
      .post(`/api/rooms/${roomCode}/color`)
      .send({ playerId: hostId, color: hostColor })
      .expect(200);

    expect(
      changed.body.room.players.find(
        (player: { playerId: string }) => player.playerId === hostId,
      ),
    ).toEqual(expect.objectContaining({ color: hostColor }));

    await request(app)
      .post(`/api/rooms/${roomCode}/color`)
      .send({ playerId: guestId, color: hostColor })
      .expect(409);

    await request(app)
      .post(`/api/rooms/${roomCode}/color`)
      .send({ playerId: guestId, color: guestColor })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomCode}/color`)
      .send({ playerId: hostId, color: ROOM_PLAYER_COLORS[7] })
      .expect(409);
  });

  test("transfers host in the lobby when the host leaves", async () => {
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: createIncrementingClock(1_780_000_000_000),
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    const left = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: hostId })
      .expect(200);

    expect(left.body.room.players).toHaveLength(1);
    expect(left.body.room.players[0]).toEqual(
      expect.objectContaining({
        playerId: guestId,
        isHost: true,
      }),
    );
  });

  test("transfers host during active play and removes empty active rooms", async () => {
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: createIncrementingClock(1_780_000_000_000),
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    const hostLeft = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: hostId })
      .expect(200);

    expect(hostLeft.body.room.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: hostId,
          connected: false,
          isHost: false,
        }),
        expect.objectContaining({
          playerId: guestId,
          connected: true,
          isHost: true,
        }),
      ]),
    );

    const guestLeft = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: guestId })
      .expect(200);

    expect(guestLeft.body.room).toBeNull();
    await request(app).get(`/api/rooms/${roomCode}`).expect(404);
  });

  test("records completed friend room players on the shared leaderboard by room player id", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "kr-all", difficultyMode: "normal" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    let room = (await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200)).body.room;

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      now += 5_000;
      const target = room.currentRound.roadviewTarget;

      await request(app)
        .post(`/api/rooms/${roomCode}/guess`)
        .send({
          playerId: hostId,
          roundIndex,
          guess: target,
        })
        .expect(200);

      await request(app)
        .post(`/api/rooms/${roomCode}/reveal`)
        .send({ playerId: hostId })
        .expect(200);

      now += 3_000;
      await request(app).get(`/api/rooms/${roomCode}`).expect(200);

      room = (await request(app)
        .post(`/api/rooms/${roomCode}/next`)
        .send({ playerId: hostId })
        .expect(200)).body.room;
    }

    expect(room.phase).toBe("finished");

    const leaderboard = await request(app).get("/api/leaderboard").expect(200);
    expect(leaderboard.body.entries[0].gameMode).toBe("room");
    expect(leaderboard.body.entries).toEqual([
      expect.objectContaining({
        playerId: hostId,
        nickname: "지훈",
        totalScore: 25_000,
        difficultyMode: "normal",
        mapName: room.mapName,
      }),
    ]);
  });

  test("includes players who did not submit in friend room reveal results", async () => {
    let now = 1_780_000_000_000;
    const app = createApiApp({
      seedCatalog: createRuntimeSeedFixture(),
      now: () => now,
    });

    const created = await request(app)
      .post("/api/rooms")
      .send({ nickname: "지훈", mapId: "seoul", difficultyMode: "mixed" })
      .expect(201);
    const roomCode = created.body.room.roomCode;
    const hostId = created.body.playerId;

    const joined = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ nickname: "하린" })
      .expect(200);
    const guestId = joined.body.playerId;

    await request(app)
      .post(`/api/rooms/${roomCode}/start`)
      .send({ playerId: hostId })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: hostId,
        roundIndex: 0,
        guess: { lat: 37.5, lng: 127.0 },
      })
      .expect(200);

    now += 31_000;

    const revealed = await request(app)
      .get(`/api/rooms/${roomCode}`)
      .expect(200);

    expect(revealed.body.room.phase).toBe("round_reveal");
    expect(revealed.body.room.revealed.guesses).toHaveLength(2);
    expect(
      revealed.body.room.revealed.guesses.find(
        (guess: { playerId: string }) => guess.playerId === guestId,
      ),
    ).toEqual(
      expect.objectContaining({
        rank: 2,
        playerId: guestId,
        guess: null,
        distanceMeters: null,
        score: 0,
        totalScore: 0,
      }),
    );
    expect(revealed.body.room.roundHistory[0].guesses).toHaveLength(2);
  });
});

function createRuntimeSeedFixture(): SeedLocation[] {
  const seoulSeeds: SeedLocation[] = Array.from({ length: 6 }, (_, index) => ({
    id: `runtime-seoul-${index + 1}`,
    title: `서울 런타임 ${index + 1}`,
    lat: 37.5 + index * 0.001,
    lng: 127 + index * 0.001,
    region1: "서울",
    region2: "테스트구",
    tags: ["runtime"],
    difficulty: index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard",
    sourceType: "osm_derived",
  }));
  const busanSeeds: SeedLocation[] = Array.from({ length: 2 }, (_, index) => ({
    id: `runtime-busan-${index + 1}`,
    title: `부산 런타임 ${index + 1}`,
    lat: 35.17 + index * 0.001,
    lng: 129.07 + index * 0.001,
    region1: "부산",
    region2: "테스트구",
    tags: ["runtime"],
    difficulty: index === 0 ? "easy" : "hard",
    sourceType: "osm_derived",
  }));

  const jeonnamSeeds: SeedLocation[] = Array.from({ length: 5 }, (_, index) => ({
    id: `runtime-jeonnam-${index + 1}`,
    title: `전남 런타임 ${index + 1}`,
    lat: 34.8 + index * 0.01,
    lng: 126.9 + index * 0.01,
    region1: "전남",
    region2: "테스트군",
    tags: ["runtime"],
    difficulty: index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard",
    sourceType: "osm_derived",
  }));

  const gyeongbukSeeds: SeedLocation[] = Array.from({ length: 5 }, (_, index) => ({
    id: `runtime-gyeongbuk-${index + 1}`,
    title: `경북 런타임 ${index + 1}`,
    lat: 36.1 + index * 0.01,
    lng: 128.3 + index * 0.01,
    region1: "경북",
    region2: "테스트시",
    tags: ["runtime"],
    difficulty: index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard",
    sourceType: "osm_derived",
  }));

  return [...seoulSeeds, ...busanSeeds, ...jeonnamSeeds, ...gyeongbukSeeds];
}

function createIncrementingClock(start: number) {
  let current = start;

  return () => {
    current += 1;
    return current;
  };
}
