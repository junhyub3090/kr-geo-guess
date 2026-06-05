import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");
const RUNTIME_SEEDS_PATH = join(
  ROOT_DIR,
  "data/seed-pipeline/runtime/verified-seeds.json",
);
const DIFFICULTIES = ["easy", "medium", "hard"];

const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
const runtimeSeeds = JSON.parse(readFileSync(RUNTIME_SEEDS_PATH, "utf8"));

if (!Array.isArray(runtimeSeeds)) {
  throw new Error("Runtime seed catalog must be a JSON array");
}

const seenIds = new Set();
for (const seed of runtimeSeeds) {
  if (!seed || typeof seed !== "object") {
    throw new Error("Runtime seed catalog contains a non-object seed");
  }

  if (seenIds.has(seed.id)) {
    throw new Error(`Duplicate runtime seed id: ${seed.id}`);
  }
  seenIds.add(seed.id);

  if (seed.sourceType !== "osm_derived") {
    throw new Error(`Runtime seed must be osm_derived: ${seed.id}`);
  }
}

for (const region of targets.regions) {
  const regionSeeds = runtimeSeeds.filter((seed) => seed.region1 === region.name);
  if (regionSeeds.length !== region.targetApproved) {
    throw new Error(
      `${region.name} runtime pool has ${regionSeeds.length}/${region.targetApproved} seeds`,
    );
  }

  for (const difficulty of DIFFICULTIES) {
    const actual = regionSeeds.filter((seed) => seed.difficulty === difficulty).length;
    const expected = region.difficultyTargets[difficulty];
    if (actual !== expected) {
      throw new Error(
        `${region.name}/${difficulty} runtime pool has ${actual}/${expected} seeds`,
      );
    }
  }
}

console.log(
  `[seed:assert] ${runtimeSeeds.length.toLocaleString("ko-KR")} runtime seeds verified across ${targets.regions.length} map pools`,
);
