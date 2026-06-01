import { describe, expect, test } from "vitest";
import {
  createMatchPlan,
  getMapSummariesFromCatalog,
  getSeedsForMapFromCatalog,
  getCurrentRound,
  getNextRoundIndex,
  selectBalancedSeeds,
  selectDifficultyWeightedSeeds,
} from "../index";

const seeds = [
  { id: "seoul-1", title: "서울 샘플 1", lat: 37.5665, lng: 126.978, region1: "서울", region2: "중구", tags: ["urban"], difficulty: "easy", sourceType: "manual" },
  { id: "busan-1", title: "부산 샘플", lat: 35.1796, lng: 129.0756, region1: "부산", region2: "연제구", tags: ["urban"], difficulty: "medium", sourceType: "manual" },
  { id: "jeju-1", title: "제주 샘플", lat: 33.4996, lng: 126.5312, region1: "제주", region2: "제주시", tags: ["island"], difficulty: "medium", sourceType: "manual" },
  { id: "gangwon-1", title: "강원 샘플", lat: 37.7519, lng: 128.8761, region1: "강원", region2: "강릉시", tags: ["coast"], difficulty: "hard", sourceType: "manual" },
  { id: "gwangju-1", title: "광주 샘플", lat: 35.1595, lng: 126.8526, region1: "광주", region2: "서구", tags: ["urban"], difficulty: "easy", sourceType: "manual" },
  { id: "seoul-2", title: "서울 샘플 2", lat: 37.4981, lng: 127.0276, region1: "서울", region2: "강남구", tags: ["urban"], difficulty: "easy", sourceType: "manual" },
] as const;

describe("round planning", () => {
  test("selects the requested number of seeds without repeating an id", () => {
    const selected = selectBalancedSeeds(seeds, 5);

    expect(selected).toHaveLength(5);
    expect(new Set(selected.map((seed) => seed.id)).size).toBe(5);
  });

  test("prefers region diversity before repeating a region", () => {
    const selected = selectBalancedSeeds(seeds, 5);

    expect(selected.filter((seed) => seed.region1 === "서울")).toHaveLength(1);
  });

  test("creates a match plan with stable round numbering", () => {
    const plan = createMatchPlan(seeds, { roundCount: 3, timerSeconds: 90 });

    expect(plan.rounds.map((round) => round.roundNumber)).toEqual([1, 2, 3]);
    expect(plan.mapId).toBe("kr-all");
    expect(plan.difficultyMode).toBe("normal");
    expect(plan.timerSeconds).toBe(90);
  });

  test("weights seed selection by selected difficulty", () => {
    const easySelected = selectDifficultyWeightedSeeds(seeds, 3, "easy");
    const hardSelected = selectDifficultyWeightedSeeds(seeds, 3, "hard");

    expect(easySelected.filter((seed) => seed.difficulty === "easy").length)
      .toBeGreaterThanOrEqual(1);
    expect(hardSelected.some((seed) => seed.difficulty === "hard")).toBe(true);
  });

  test("filters arbitrary seed catalogs by selected game map", () => {
    const seoulSeeds = getSeedsForMapFromCatalog(seeds, "seoul");
    const allSeeds = getSeedsForMapFromCatalog(seeds, "kr-all");
    const summaries = getMapSummariesFromCatalog(seeds);

    expect(seoulSeeds.map((seed) => seed.id)).toEqual(["seoul-1", "seoul-2"]);
    expect(allSeeds).toHaveLength(seeds.length);
    expect(summaries.find((gameMap) => gameMap.id === "seoul")?.seedCount).toBe(2);
    expect(summaries.find((gameMap) => gameMap.id === "gangwon")?.seedCount).toBe(1);
  });

  test("returns current round and next round index", () => {
    const plan = createMatchPlan(seeds, { roundCount: 3, timerSeconds: 90 });

    expect(getCurrentRound(plan, 1)?.roundNumber).toBe(2);
    expect(getNextRoundIndex(plan, 1)).toBe(2);
    expect(getNextRoundIndex(plan, 2)).toBe(null);
  });
});
