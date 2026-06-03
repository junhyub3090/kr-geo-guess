import { describe, expect, test } from "vitest";
import {
  distanceMeters,
  formatDistance,
  scoreClassic,
  scoreTimedClassic,
  submitRoundGuess,
} from "../index";

describe("geo distance and scoring", () => {
  test("returns 0 meters for identical coordinates", () => {
    const distance = distanceMeters(
      { lat: 37.5665, lng: 126.978 },
      { lat: 37.5665, lng: 126.978 },
    );

    expect(distance).toBe(0);
  });

  test("calculates Seoul City Hall to Busan City Hall distance within a realistic range", () => {
    const distance = distanceMeters(
      { lat: 37.5665, lng: 126.978 },
      { lat: 35.1796, lng: 129.0756 },
    );

    expect(distance).toBeGreaterThan(320_000);
    expect(distance).toBeLessThan(340_000);
  });

  test("gives a perfect score inside the national perfect radius", () => {
    const score = scoreClassic(20, "national");

    expect(score).toBe(5000);
  });

  test("city scope penalizes the same miss more than national scope", () => {
    const national = scoreClassic(10_000, "national");
    const city = scoreClassic(10_000, "city");

    expect(city).toBeLessThan(national);
  });

  test("province and city maps use stricter scoring than the national map", () => {
    const national = scoreClassic(30_000, "national");
    const province = scoreClassic(30_000, "province");
    const city = scoreClassic(30_000, "city");

    expect(province).toBeLessThan(national);
    expect(city).toBeLessThan(province);
  });

  test("gives zero points without a submitted pin", () => {
    const result = submitRoundGuess({
      roundNumber: 1,
      target: {
        id: "target",
        title: "테스트 위치",
        lat: 37.5,
        lng: 127,
        region1: "서울",
        region2: "테스트구",
        tags: ["test"],
        difficulty: "medium",
        sourceType: "manual",
      },
      guess: null,
      scope: "city",
    });

    expect(result.score).toBe(0);
    expect(result.distanceScore).toBe(0);
    expect(result.timeBonus).toBe(0);
    expect(result.distanceMeters).toBeNull();
    expect(result.guess).toBeNull();
  });

  test("submit result includes timing bonus without making speed dominant", () => {
    const target = {
      id: "target",
      title: "테스트 위치",
      lat: 37.5,
      lng: 127,
      region1: "서울",
      region2: "테스트구",
      tags: ["test"],
      difficulty: "medium",
      sourceType: "manual",
    } as const;
    const slow = submitRoundGuess({
      roundNumber: 1,
      target,
      guess: { lat: 37.501, lng: 127.001 },
      scope: "city",
      timeRemainingSeconds: 0,
      timerSeconds: 30,
    });
    const fast = submitRoundGuess({
      roundNumber: 1,
      target,
      guess: { lat: 37.501, lng: 127.001 },
      scope: "city",
      timeRemainingSeconds: 30,
      timerSeconds: 30,
    });

    expect(fast.distanceScore).toBe(slow.distanceScore);
    expect(fast.timeBonus).toBeGreaterThan(0);
    expect(fast.timeBonus).toBeLessThanOrEqual(200);
    expect(fast.score).toBeGreaterThan(slow.score);
    expect(fast.score).toBeLessThanOrEqual(5000);
  });

  test("score never goes below 0 or above 5000", () => {
    expect(scoreClassic(0, "national")).toBe(5000);
    expect(scoreClassic(20_000_000, "national")).toBe(0);
    expect(
      scoreTimedClassic(0, "national", {
        remainingSeconds: 30,
        timerSeconds: 30,
      }),
    ).toBe(5000);
  });

  test("time bonus is small and weighted by distance accuracy", () => {
    const closeDistanceScore = scoreClassic(1_000, "province");
    const slowClose = scoreTimedClassic(1_000, "province", {
      remainingSeconds: 0,
      timerSeconds: 30,
    });
    const fastClose = scoreTimedClassic(1_000, "province", {
      remainingSeconds: 30,
      timerSeconds: 30,
    });
    const fastFar = scoreTimedClassic(100_000, "province", {
      remainingSeconds: 30,
      timerSeconds: 30,
    });

    expect(slowClose).toBe(closeDistanceScore);
    expect(fastClose - slowClose).toBeGreaterThan(0);
    expect(fastClose - slowClose).toBeLessThanOrEqual(200);
    expect(fastFar - scoreClassic(100_000, "province")).toBeLessThan(
      fastClose - slowClose,
    );
  });

  test("time bonus is based on elapsed seconds, not timer length", () => {
    const thirtySecondFast = scoreTimedClassic(5_000, "province", {
      remainingSeconds: 25,
      timerSeconds: 30,
    });
    const ninetySecondFast = scoreTimedClassic(5_000, "province", {
      remainingSeconds: 85,
      timerSeconds: 90,
    });
    const ninetySecondSlow = scoreTimedClassic(5_000, "province", {
      remainingSeconds: 60,
      timerSeconds: 90,
    });

    expect(ninetySecondFast).toBe(thirtySecondFast);
    expect(ninetySecondSlow).toBeLessThan(ninetySecondFast);
  });

  test("formats short and long distances for Korean UI", () => {
    expect(formatDistance(842)).toBe("842 m");
    expect(formatDistance(12_340)).toBe("12.3 km");
  });
});
