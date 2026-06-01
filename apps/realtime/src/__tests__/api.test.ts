import request from "supertest";
import { describe, expect, test } from "vitest";
import { KOREA_SEED_CATALOG, type SeedLocation } from "@kr-geo-guess/shared";
import { createApiApp } from "../http/createApiApp.js";

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
    expect(leaderboard.body.entries[0]).toHaveProperty("rank", 1);
    expect(leaderboard.body.entries.length).toBeGreaterThanOrEqual(3);
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
      .toBe(5);

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

  test("runs a shared friend room with hidden peer pins until reveal", async () => {
    const runtimeSeeds = createRuntimeSeedFixture();
    const app = createApiApp({
      seedCatalog: runtimeSeeds,
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

    const revealed = await request(app)
      .post(`/api/rooms/${roomCode}/guess`)
      .send({
        playerId: guestId,
        roundIndex: 0,
        guess: { lat: 37.51, lng: 127.01 },
      })
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
        playerId: guestId,
        guess: null,
        distanceMeters: null,
        score: 0,
        totalScore: 0,
      }),
    );
  });
});

function createRuntimeSeedFixture(): SeedLocation[] {
  const seoulSeeds: SeedLocation[] = Array.from({ length: 5 }, (_, index) => ({
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

  return [...seoulSeeds, ...busanSeeds, ...jeonnamSeeds];
}

function createIncrementingClock(start: number) {
  let current = start;

  return () => {
    current += 1;
    return current;
  };
}
