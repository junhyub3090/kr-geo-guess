import { loadRuntimeSeedCatalog } from "../apps/realtime/dist/apps/realtime/src/http/seedCatalog.js";
import { getMapSummariesFromCatalog } from "@kr-geo-guess/shared";

const MIN_EXPECTED_RUNTIME_SEEDS = 17_000;
const MIN_EXPECTED_MAP_POOLS = 17;

const runtimeSeeds = loadRuntimeSeedCatalog();
const mapSummaries = getMapSummariesFromCatalog(runtimeSeeds);
const unplayableMaps = mapSummaries.filter((gameMap) => gameMap.playable === false);

if (runtimeSeeds.length < MIN_EXPECTED_RUNTIME_SEEDS) {
  throw new Error(
    `Built API loaded only ${runtimeSeeds.length.toLocaleString("ko-KR")} runtime seeds; expected at least ${MIN_EXPECTED_RUNTIME_SEEDS.toLocaleString("ko-KR")}`,
  );
}

if (mapSummaries.length < MIN_EXPECTED_MAP_POOLS) {
  throw new Error(
    `Built API exposed only ${mapSummaries.length} map pools; expected at least ${MIN_EXPECTED_MAP_POOLS}`,
  );
}

if (unplayableMaps.length > 0) {
  throw new Error(
    `Built API has unplayable maps: ${unplayableMaps
      .map((gameMap) => `${gameMap.name}=${gameMap.seedCount}`)
      .join(", ")}`,
  );
}

console.log(
  `[api:seed:assert] built API loaded ${runtimeSeeds.length.toLocaleString("ko-KR")} runtime seeds and ${mapSummaries.length} playable map pools`,
);
