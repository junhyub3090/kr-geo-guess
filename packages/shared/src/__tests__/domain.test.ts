import { describe, expect, test } from "vitest";
import {
  KOREA_SEED_CATALOG,
  createDailyChallenge,
  createLeaderboard,
  createPublicRound,
  createRoomCode,
  getGameMap,
  getMapSummaries,
  getSeedsForMap,
  isInsideKoreaBounds,
  normalizeNickname,
  submitRoundGuess,
} from "../index";

describe("player and room domain rules", () => {
  test("normalizes empty and long nicknames for guest-first play", () => {
    expect(normalizeNickname("")).toBe("게스트");
    expect(normalizeNickname("  지훈  ")).toBe("지훈");
    expect(normalizeNickname("매우긴닉네임을입력한사용자")).toBe("매우긴닉네임을입");
  });

  test("creates readable deterministic room codes from a seed", () => {
    expect(createRoomCode("match-abc")).toMatch(/^KR-[A-Z0-9]{4}$/);
    expect(createRoomCode("match-abc")).toBe(createRoomCode("match-abc"));
    expect(createRoomCode("match-def")).not.toBe(createRoomCode("match-abc"));
  });
});

describe("Korea coordinate validation", () => {
  test("accepts points inside Korea gameplay bounds", () => {
    expect(isInsideKoreaBounds({ lat: 37.5665, lng: 126.978 })).toBe(true);
    expect(isInsideKoreaBounds({ lat: 33.4996, lng: 126.5312 })).toBe(true);
    expect(isInsideKoreaBounds({ lat: 37.2411, lng: 131.8648 })).toBe(true);
  });

  test("rejects impossible or outside-bounds guesses", () => {
    expect(isInsideKoreaBounds({ lat: Number.NaN, lng: 126.978 })).toBe(false);
    expect(isInsideKoreaBounds({ lat: 40.7, lng: -74.0 })).toBe(false);
  });
});

describe("public round payloads and submissions", () => {
  test("public round exposes the roadview coordinate without revealing answer pins", () => {
    const round = createPublicRound(KOREA_SEED_CATALOG[0], 1, 90_000);

    expect(round).toEqual({
      roundNumber: 1,
      seedId: "seoul-west-hillside-alley",
      regionHint: "서울",
      mapId: "kr-all",
      mapName: "전국",
      difficulty: "hard",
      tags: ["alley", "hillside", "ordinary-road"],
      roadviewTarget: { lat: 37.5948, lng: 126.9169 },
      timerEndsAt: 90_000,
    });
  });

  test("submits a valid guess and returns reveal-safe scoring data", () => {
    const result = submitRoundGuess({
      roundNumber: 1,
      target: KOREA_SEED_CATALOG[0],
      guess: {
        lat: KOREA_SEED_CATALOG[0].lat + 0.0002,
        lng: KOREA_SEED_CATALOG[0].lng + 0.0002,
      },
      scope: "national",
    });

    expect(result.score).toBeGreaterThan(4900);
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.target.region1).toBe("서울");
  });

  test("rejects guesses outside Korea bounds", () => {
    expect(() =>
      submitRoundGuess({
        roundNumber: 1,
        target: KOREA_SEED_CATALOG[0],
        guess: { lat: 40.7, lng: -74.0 },
        scope: "national",
      }),
    ).toThrow("Guess is outside supported Korea bounds");
  });
});

describe("map catalog", () => {
  test("serves selectable Korea maps with seed counts", () => {
    const summaries = getMapSummaries();

    expect(summaries.find((gameMap) => gameMap.id === "kr-all")?.seedCount)
      .toBe(KOREA_SEED_CATALOG.length);
    expect(summaries.find((gameMap) => gameMap.id === "seoul")?.seedCount)
      .toBeGreaterThanOrEqual(5);
    expect(summaries.find((gameMap) => gameMap.id === "seoul")?.playable)
      .toBe(true);
    expect(summaries.find((gameMap) => gameMap.id === "jeju")?.seedCount)
      .toBeGreaterThanOrEqual(5);
    expect(summaries.find((gameMap) => gameMap.id === "gyeongbuk")?.playable)
      .toBe(false);
    expect(summaries.find((gameMap) => gameMap.id === "gyeongbuk")?.minimumSeedCount)
      .toBe(5);
  });

  test("serves maps in the expected administrative picker order with concise city names", () => {
    expect(getMapSummaries().map((gameMap) => gameMap.name)).toEqual([
      "전국",
      "서울",
      "부산",
      "대구",
      "인천",
      "광주",
      "대전",
      "울산",
      "세종",
      "경기도",
      "강원도",
      "충청북도",
      "충청남도",
      "경상북도",
      "경상남도",
      "전라북도",
      "전라남도",
      "제주도",
    ]);
  });

  test("filters seeds by selected map", () => {
    expect(getGameMap("gangwon").name).toBe("강원도");
    expect(getSeedsForMap("gangwon").every((seed) => seed.region1 === "강원"))
      .toBe(true);
    expect(getSeedsForMap("missing-map")).toHaveLength(KOREA_SEED_CATALOG.length);
  });
});

describe("daily challenge and leaderboard", () => {
  test("creates stable Korea-time daily challenge seed ordering", () => {
    const first = createDailyChallenge(KOREA_SEED_CATALOG, "2026-06-01");
    const second = createDailyChallenge(KOREA_SEED_CATALOG, "2026-06-01");

    expect(first.id).toBe("daily-2026-06-01");
    expect(first.timerSeconds).toBe(30);
    expect(first.rounds.map((round) => round.seed.id)).toEqual(
      second.rounds.map((round) => round.seed.id),
    );
  });

  test("leaderboard sorts by score descending then time ascending", () => {
    const leaderboard = createLeaderboard([
      { playerId: "1", nickname: "민서", totalScore: 9000, totalDistanceMeters: 3000, totalTimeSeconds: 130 },
      { playerId: "2", nickname: "지훈", totalScore: 9400, totalDistanceMeters: 5000, totalTimeSeconds: 160 },
      { playerId: "3", nickname: "하린", totalScore: 9400, totalDistanceMeters: 4000, totalTimeSeconds: 120 },
    ]);

    expect(leaderboard.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(leaderboard.map((entry) => entry.nickname)).toEqual(["하린", "지훈", "민서"]);
  });
});
