import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");
const CANDIDATES_DIR = join(ROOT_DIR, "data/seed-pipeline/candidates");
const OUTPUT_PATH = join(
  ROOT_DIR,
  "data/seed-pipeline/runtime/verified-seeds.json",
);
const STALE_SEEDS_PATH = join(
  ROOT_DIR,
  "data/seed-pipeline/runtime/stale-seeds.json",
);
const SUMMARY_PATH = join(
  ROOT_DIR,
  "data/seed-pipeline/runtime/verified-seeds.summary.json",
);
const DIFFICULTIES = ["easy", "medium", "hard"];

const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
const candidateRows = dedupeCandidateRows(readCandidateRows(CANDIDATES_DIR));
const staleSeedIds = readStaleSeedIds(STALE_SEEDS_PATH);
const compiledSeeds = [];
const summary = {
  generatedAt: new Date().toISOString(),
  source: "openstreetmap candidates verified by Kakao Roadview availability and Kakao region reverse geocoding",
  storesProviderImages: false,
  storesProviderPanoIds: false,
  excludedStaleSeedCount: staleSeedIds.size,
  regions: [],
};

for (const region of targets.regions) {
  const regionRows = candidateRows.filter(
    (row) =>
      row.status === "roadview_verified" &&
      row.roadviewVerified === true &&
      row.regionVerified === true &&
      row.region1 === region.name,
  ).filter(
    (row) => !staleSeedIds.has(row.id),
  );
  const regionSeeds = [];
  const difficultySummary = {};

  for (const difficulty of DIFFICULTIES) {
    const targetCount = region.difficultyTargets[difficulty];
    const availableRows = regionRows.filter((row) => row.difficulty === difficulty);
    const selectedRows = selectVariedRows(
      availableRows,
      targetCount,
      `${region.id}-${difficulty}`,
    );

    if (selectedRows.length < targetCount) {
      throw new Error(
        `${region.name}/${difficulty} has ${selectedRows.length}/${targetCount} verified rows`,
      );
    }

    difficultySummary[difficulty] = selectedRows.length;
    regionSeeds.push(
      ...selectedRows.map((row) => toRuntimeSeed(row, region)),
    );
  }

  if (regionSeeds.length !== region.targetApproved) {
    throw new Error(
      `${region.name} compiled ${regionSeeds.length}/${region.targetApproved} seeds`,
    );
  }

  compiledSeeds.push(...regionSeeds);
  summary.regions.push({
    id: region.id,
    name: region.name,
    total: regionSeeds.length,
    difficulties: difficultySummary,
  });
}

assertUniqueIds(compiledSeeds);

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(compiledSeeds, null, 2)}\n`);
writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);

console.log(
  `[seed:compile] wrote ${compiledSeeds.length} runtime seeds to ${OUTPUT_PATH}`,
);

function readCandidateRows(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const rows = [];
  for (const filePath of walkFiles(rootDir)) {
    if (!filePath.endsWith(".roadview.jsonl")) {
      continue;
    }

    const content = readFileSync(filePath, "utf8").trim();
    if (!content) {
      continue;
    }

    content.split("\n").forEach((line, index) => {
      try {
        rows.push(JSON.parse(line));
      } catch (error) {
        throw new Error(`${filePath}:${index + 1} JSONL parse failed: ${error.message}`);
      }
    });
  }
  return rows;
}

function dedupeCandidateRows(rows) {
  const byId = new Map();

  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing || statusPriority(row.status) >= statusPriority(existing.status)) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
}

function readStaleSeedIds(path) {
  if (!existsSync(path)) {
    return new Set();
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed.seeds;

  if (!Array.isArray(rows)) {
    throw new Error(`Stale seed file must contain a seeds array: ${path}`);
  }

  return new Set(
    rows
      .map((row) => (typeof row === "string" ? row : row?.id))
      .filter((id) => typeof id === "string" && id.length > 0),
  );
}

function statusPriority(status) {
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

function selectVariedRows(rows, count, salt) {
  const grouped = new Map();

  for (const row of deterministicShuffle(rows, `${salt}-rows`)) {
    const group = row.kakaoRegion?.region2 ?? row.region2 ?? "미상";
    const groupRows = grouped.get(group) ?? [];
    groupRows.push(row);
    grouped.set(group, groupRows);
  }

  const groups = deterministicShuffle([...grouped.values()], `${salt}-groups`);
  const selected = [];
  let cursor = 0;

  while (selected.length < count && groups.some((groupRows) => groupRows.length > 0)) {
    const group = groups[cursor % groups.length];
    const row = group.shift();
    if (row) {
      selected.push(row);
    }
    cursor += 1;
  }

  return selected;
}

function toRuntimeSeed(row, region) {
  const region2 = normalizeString(row.kakaoRegion?.region2 ?? row.region2);

  return {
    id: row.id,
    title: region2 ? `${region.name} ${region2} 위치` : `${region.name} 위치`,
    lat: roundCoordinate(row.lat),
    lng: roundCoordinate(row.lng),
    region1: region.name,
    region2,
    tags: sanitizeTags(row.tags),
    difficulty: row.difficulty,
    sourceType: "osm_derived",
  };
}

function sanitizeTags(tags) {
  const cleaned = (Array.isArray(tags) ? tags : []).filter(
    (tag) =>
      typeof tag === "string" &&
      tag !== "osm-candidate" &&
      !tag.startsWith("highway:"),
  );

  return cleaned.length > 0 ? cleaned.slice(0, 4) : ["verified-roadview"];
}

function normalizeString(value) {
  return typeof value === "string" ? value : "";
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function assertUniqueIds(seeds) {
  const ids = new Set();

  for (const seed of seeds) {
    if (ids.has(seed.id)) {
      throw new Error(`Duplicate runtime seed id: ${seed.id}`);
    }
    ids.add(seed.id);
  }
}

function walkFiles(dir) {
  const entries = readdirSync(dir)
    .map((entry) => join(dir, entry))
    .sort();

  return entries.flatMap((entry) => {
    const stats = statSync(entry);
    return stats.isDirectory() ? walkFiles(entry) : [entry];
  });
}

function deterministicShuffle(items, seedValue) {
  const output = [...items];
  let state = hashString(seedValue);

  for (let index = output.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
}

function hashString(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function nextRandomState(state) {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
