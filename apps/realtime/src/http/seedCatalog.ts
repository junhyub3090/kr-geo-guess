import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { KOREA_SEED_CATALOG, type SeedLocation } from "@kr-geo-guess/shared";

const ROOT_DIR = fileURLToPath(new URL("../../../../", import.meta.url));
const RUNTIME_SEED_PATH = join(
  ROOT_DIR,
  "data/seed-pipeline/runtime/verified-seeds.json",
);

export function loadRuntimeSeedCatalog(): readonly SeedLocation[] {
  if (!existsSync(RUNTIME_SEED_PATH)) {
    return KOREA_SEED_CATALOG;
  }

  try {
    const parsed = JSON.parse(readFileSync(RUNTIME_SEED_PATH, "utf8"));
    if (isSeedCatalog(parsed)) {
      return parsed;
    }

    console.warn(
      `[seedCatalog] ignored invalid runtime seed catalog at ${RUNTIME_SEED_PATH}`,
    );
  } catch (error) {
    console.warn(
      `[seedCatalog] failed to load runtime seed catalog at ${RUNTIME_SEED_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return KOREA_SEED_CATALOG;
}

function isSeedCatalog(value: unknown): value is SeedLocation[] {
  return Array.isArray(value) && value.every(isSeedLocation);
}

function isSeedLocation(value: unknown): value is SeedLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const seed = value as Partial<SeedLocation>;
  return (
    typeof seed.id === "string" &&
    typeof seed.title === "string" &&
    typeof seed.lat === "number" &&
    typeof seed.lng === "number" &&
    typeof seed.region1 === "string" &&
    typeof seed.region2 === "string" &&
    Array.isArray(seed.tags) &&
    (seed.difficulty === "easy" ||
      seed.difficulty === "medium" ||
      seed.difficulty === "hard") &&
    seed.sourceType === "osm_derived"
  );
}
