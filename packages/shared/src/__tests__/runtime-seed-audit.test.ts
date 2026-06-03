import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  KOREA_GAME_MAPS,
  getSeedsForMapFromCatalog,
  type SeedLocation,
} from "../index";

type CandidateRow = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  region1: string;
  roadviewVerified?: boolean;
  regionVerified?: boolean;
  kakaoRegion?: {
    region1?: string | null;
  };
};

type RegionTarget = {
  id: string;
  name: string;
  targetApproved: number;
  kakaoRegion1Names?: string[];
};

const repoRoot = join(__dirname, "../../../..");

describe("runtime seed region audit", () => {
  test("uses only Kakao-region-verified coordinates in the runtime pool", () => {
    const seeds = readJson<SeedLocation[]>(
      join(repoRoot, "data/seed-pipeline/runtime/verified-seeds.json"),
    );
    const targets = readJson<{ regions: RegionTarget[] }>(
      join(repoRoot, "data/seed-pipeline/region-targets.ko.json"),
    );
    const candidates = dedupeById(
      readCandidateRows(join(repoRoot, "data/seed-pipeline/candidates")),
    );
    const expectedNamesByRegion = new Map(
      targets.regions.map((region) => [
        region.name,
        new Set(region.kakaoRegion1Names ?? [region.name]),
      ]),
    );

    for (const seed of seeds) {
      const candidate = candidates.get(seed.id);
      const expectedNames =
        expectedNamesByRegion.get(seed.region1) ?? new Set([seed.region1]);

      expect(candidate, seed.id).toBeDefined();
      expect(candidate?.status, seed.id).toBe("roadview_verified");
      expect(candidate?.roadviewVerified, seed.id).toBe(true);
      expect(candidate?.regionVerified, seed.id).toBe(true);
      expect(expectedNames.has(candidate?.kakaoRegion?.region1 ?? ""), seed.id)
        .toBe(true);
      expect(seed.lat, seed.id).toBe(Number(candidate?.lat.toFixed(6)));
      expect(seed.lng, seed.id).toBe(Number(candidate?.lng.toFixed(6)));
    }
  });

  test("selectable maps only expose seeds from their configured region", () => {
    const seeds = readJson<SeedLocation[]>(
      join(repoRoot, "data/seed-pipeline/runtime/verified-seeds.json"),
    );

    for (const gameMap of KOREA_GAME_MAPS) {
      if (gameMap.id === "kr-all") {
        continue;
      }

      const allowedRegions = new Set(gameMap.regions);
      const mapSeeds = getSeedsForMapFromCatalog(seeds, gameMap.id);

      expect(mapSeeds.length, gameMap.id).toBeGreaterThan(0);
      expect(
        mapSeeds.every((seed) => allowedRegions.has(seed.region1)),
        gameMap.id,
      ).toBe(true);
    }
  });

  test("selectable administrative maps cover every runtime region exactly once", () => {
    const seeds = readJson<SeedLocation[]>(
      join(repoRoot, "data/seed-pipeline/runtime/verified-seeds.json"),
    );
    const targets = readJson<{ regions: RegionTarget[] }>(
      join(repoRoot, "data/seed-pipeline/region-targets.ko.json"),
    );
    const targetRegionNames = targets.regions
      .map((region) => region.name)
      .sort((a, b) => a.localeCompare(b, "ko"));
    const runtimeRegionNames = [...new Set(seeds.map((seed) => seed.region1))]
      .sort((a, b) => a.localeCompare(b, "ko"));
    const assignedRegionNames = KOREA_GAME_MAPS
      .filter((gameMap) => gameMap.id !== "kr-all")
      .flatMap((gameMap) => {
        expect(gameMap.regions, gameMap.id).toHaveLength(1);
        return [...gameMap.regions];
      });
    const uniqueAssignedRegionNames = [...new Set(assignedRegionNames)]
      .sort((a, b) => a.localeCompare(b, "ko"));

    expect(runtimeRegionNames).toEqual(targetRegionNames);
    expect(uniqueAssignedRegionNames).toEqual(targetRegionNames);
    expect(assignedRegionNames).toHaveLength(uniqueAssignedRegionNames.length);
    expect(KOREA_GAME_MAPS.find((gameMap) => gameMap.id === "kr-all")?.regions)
      .toHaveLength(0);
  });

  test("national map is exactly the non-overlapping union of all administrative maps", () => {
    const seeds = readJson<SeedLocation[]>(
      join(repoRoot, "data/seed-pipeline/runtime/verified-seeds.json"),
    );
    const targets = readJson<{ regions: RegionTarget[] }>(
      join(repoRoot, "data/seed-pipeline/region-targets.ko.json"),
    );
    const targetByRegionName = new Map(
      targets.regions.map((region) => [region.name, region]),
    );
    const nationalSeedIds = new Set(
      getSeedsForMapFromCatalog(seeds, "kr-all").map((seed) => seed.id),
    );
    const unionSeedIds = new Set<string>();

    for (const gameMap of KOREA_GAME_MAPS) {
      if (gameMap.id === "kr-all") {
        continue;
      }

      const target = targetByRegionName.get(gameMap.regions[0] ?? "");
      const mapSeeds = getSeedsForMapFromCatalog(seeds, gameMap.id);

      expect(target, gameMap.id).toBeDefined();
      expect(mapSeeds, gameMap.id).toHaveLength(target?.targetApproved ?? 0);

      for (const seed of mapSeeds) {
        expect(unionSeedIds.has(seed.id), `${gameMap.id}:${seed.id}`).toBe(false);
        unionSeedIds.add(seed.id);
      }
    }

    expect([...unionSeedIds].sort()).toEqual([...nationalSeedIds].sort());
    expect(unionSeedIds.size).toBe(seeds.length);
  });
});

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readCandidateRows(rootDir: string) {
  const rows: CandidateRow[] = [];

  for (const filePath of walkFiles(rootDir)) {
    if (!filePath.endsWith(".roadview.jsonl")) {
      continue;
    }

    const content = readFileSync(filePath, "utf8").trim();
    if (!content) {
      continue;
    }

    rows.push(
      ...content.split("\n").map((line) => JSON.parse(line) as CandidateRow),
    );
  }

  return rows;
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir)
    .map((entry) => join(dir, entry))
    .flatMap((entry) => statSync(entry).isDirectory() ? walkFiles(entry) : [entry]);
}

function dedupeById(rows: CandidateRow[]) {
  const byId = new Map<string, CandidateRow>();

  for (const row of rows) {
    const current = byId.get(row.id);
    if (!current || statusPriority(row.status) >= statusPriority(current.status)) {
      byId.set(row.id, row);
    }
  }

  return byId;
}

function statusPriority(status: string) {
  if (status === "approved") {
    return 4;
  }
  if (status === "roadview_verified") {
    return 3;
  }
  if (status === "rejected") {
    return 2;
  }
  return 1;
}
