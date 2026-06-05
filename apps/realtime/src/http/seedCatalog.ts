import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KOREA_SEED_CATALOG, type SeedLocation } from "@kr-geo-guess/shared";

const RUNTIME_SEED_RELATIVE_PATH =
  "data/seed-pipeline/runtime/verified-seeds.json";
const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));

export function loadRuntimeSeedCatalog(): readonly SeedLocation[] {
  const checkedPaths: string[] = [];

  for (const seedPath of getRuntimeSeedPathCandidates()) {
    checkedPaths.push(seedPath);
    if (!existsSync(seedPath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(readFileSync(seedPath, "utf8"));
      if (isSeedCatalog(parsed)) {
        return parsed;
      }

      console.warn(
        `[seedCatalog] ignored invalid runtime seed catalog at ${seedPath}`,
      );
    } catch (error) {
      console.warn(
        `[seedCatalog] failed to load runtime seed catalog at ${seedPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  console.warn(
    `[seedCatalog] runtime seed catalog not found; using manual fallback. Checked: ${checkedPaths.join("; ")}`,
  );
  return KOREA_SEED_CATALOG;
}

function getRuntimeSeedPathCandidates() {
  const explicitSeedPath =
    process.env.RUNTIME_SEED_CATALOG_FILE ?? process.env.SEED_CATALOG_FILE;
  const candidates = [
    explicitSeedPath
      ? isAbsolute(explicitSeedPath)
        ? explicitSeedPath
        : join(process.cwd(), explicitSeedPath)
      : null,
    join(process.cwd(), RUNTIME_SEED_RELATIVE_PATH),
    join(process.cwd(), "../../", RUNTIME_SEED_RELATIVE_PATH),
    join(MODULE_DIR, "../../../../", RUNTIME_SEED_RELATIVE_PATH),
    join(MODULE_DIR, "../../../../../../../", RUNTIME_SEED_RELATIVE_PATH),
  ].filter((seedPath): seedPath is string => Boolean(seedPath));

  return [...new Set(candidates)];
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
