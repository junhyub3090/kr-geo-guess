import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");
const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const DIFFICULTIES = ["easy", "medium", "hard"];
const HIGHWAY_PATTERNS = {
  easy: "primary|secondary|tertiary|residential|living_street",
  medium: "tertiary|residential|unclassified|service|living_street",
  hard: "tertiary|residential|unclassified|service|track",
};

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.region || !args.difficulty) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
const region = targets.regions.find(
  (item) => item.id === args.region || item.name === args.region,
);
const difficulty = args.difficulty;

if (!region) {
  throw new Error(`Unknown region: ${args.region}`);
}

if (!DIFFICULTIES.includes(difficulty)) {
  throw new Error(`Unknown difficulty: ${difficulty}`);
}

const limit = parsePositiveInt(args.limit, region.difficultyTargets[difficulty]);
const minDistanceMeters = parsePositiveInt(args["min-distance-meters"], 350);
const tiles = parsePositiveInt(args.tiles, 1);
const tileDelayMs = parseNonNegativeInt(args["tile-delay-ms"], tiles > 1 ? 3500 : 0);
const maxRetries = parseNonNegativeInt(args["max-retries"], 4);
const endpoint = args.endpoint ?? DEFAULT_OVERPASS_ENDPOINT;
const outputPath =
  args.out ??
  join(ROOT_DIR, `data/seed-pipeline/candidates/${region.id}-${difficulty}.jsonl`);
const query = buildOverpassQuery(region.bbox, difficulty);

if (args["dry-run"]) {
  console.log(query);
  process.exit(0);
}

console.log(
  `[candidates] ${region.name}/${difficulty} Overpass request started, target ${limit} rows`,
);

const elements = await fetchElements(endpoint, region, difficulty, tiles, {
  tileDelayMs,
  maxRetries,
});
console.log(
  `[candidates] ${region.name}/${difficulty} received ${elements.length} OSM ways, sampling candidates`,
);
const rawCandidates = extractCandidates(elements, region, difficulty);
const selected = selectSpacedCandidates(rawCandidates, limit, minDistanceMeters);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, selected.map((row) => JSON.stringify(row)).join("\n") + "\n");

console.log(
  `[candidates] wrote ${selected.length} candidate rows to ${outputPath} (${region.name}/${difficulty})`,
);

function parseArgs(argv) {
  const output = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      output[key] = true;
      continue;
    }

    output[key] = next;
    index += 1;
  }

  return output;
}

function printHelp() {
  console.log(`Usage:
  npm run seed:candidates -- --region seoul --difficulty easy --limit 50

Options:
  --region                 region id or Korean name from data/seed-pipeline/region-targets.ko.json
  --difficulty             easy | medium | hard
  --limit                  max rows to write, defaults to the region difficulty target
  --min-distance-meters    minimum spacing between selected candidates, default 350
  --out                    output JSONL path
  --endpoint               Overpass API endpoint, default ${DEFAULT_OVERPASS_ENDPOINT}
  --tiles                  split bbox into an N x N grid to avoid large Overpass timeouts
  --tile-delay-ms          delay between tile requests, default 3500 when --tiles > 1
  --max-retries            retries for 429/5xx tile failures, default 4
  --dry-run                print query only
`);
}

function parsePositiveInt(rawValue, fallback) {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${rawValue}`);
  }

  return parsed;
}

function parseNonNegativeInt(rawValue, fallback) {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, got ${rawValue}`);
  }

  return parsed;
}

async function fetchElements(endpoint, region, difficulty, tiles, options) {
  const bboxes = splitBbox(region.bbox, tiles);
  const byId = new Map();

  for (let index = 0; index < bboxes.length; index += 1) {
    const bbox = bboxes[index];
    const query = buildOverpassQuery(bbox, difficulty);
    console.log(
      `[candidates] ${region.name}/${difficulty} tile ${index + 1}/${bboxes.length} request`,
    );

    const payload = await fetchOverpassJson(endpoint, query, {
      label: `${region.name}/${difficulty} tile ${index + 1}/${bboxes.length}`,
      maxRetries: options.maxRetries,
    });
    for (const element of payload.elements ?? []) {
      element.candidateBbox = bbox;
      byId.set(element.id, element);
    }
    console.log(
      `[candidates] ${region.name}/${difficulty} tile ${index + 1}/${bboxes.length} received ${(payload.elements ?? []).length} ways, unique ${byId.size}`,
    );

    if (options.tileDelayMs > 0 && index < bboxes.length - 1) {
      console.log(
        `[candidates] ${region.name}/${difficulty} waiting ${options.tileDelayMs}ms before next tile`,
      );
      await delay(options.tileDelayMs);
    }
  }

  return [...byId.values()];
}

async function fetchOverpassJson(endpoint, query, options) {
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "user-agent": "kr-geo-guess-seed-candidate-generator/0.1",
      },
      body: new URLSearchParams({ data: query }),
    });

    if (response.ok) {
      return response.json();
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= options.maxRetries) {
      throw new Error(
        `Overpass request failed on ${options.label}: ${response.status} ${response.statusText}`,
      );
    }

    const retryDelayMs = 10000 * (attempt + 1);
    console.log(
      `[candidates] ${options.label} got ${response.status}; retry ${attempt + 1}/${options.maxRetries} after ${retryDelayMs}ms`,
    );
    await delay(retryDelayMs);
  }

  throw new Error(`Overpass request failed on ${options.label}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitBbox(bbox, tiles) {
  if (tiles <= 1) {
    return [bbox];
  }

  const output = [];
  const latStep = (bbox.north - bbox.south) / tiles;
  const lngStep = (bbox.east - bbox.west) / tiles;

  for (let latIndex = 0; latIndex < tiles; latIndex += 1) {
    for (let lngIndex = 0; lngIndex < tiles; lngIndex += 1) {
      output.push({
        south: bbox.south + latStep * latIndex,
        west: bbox.west + lngStep * lngIndex,
        north: latIndex === tiles - 1 ? bbox.north : bbox.south + latStep * (latIndex + 1),
        east: lngIndex === tiles - 1 ? bbox.east : bbox.west + lngStep * (lngIndex + 1),
      });
    }
  }

  return output;
}

function buildOverpassQuery(bbox, difficulty) {
  const { south, west, north, east } = bbox;
  const highwayPattern = HIGHWAY_PATTERNS[difficulty];

  return `[out:json][timeout:120];
(
  way["highway"~"^(${highwayPattern})$"]["access"!~"^(private|no)$"](${south},${west},${north},${east});
);
out geom;`;
}

function extractCandidates(elements, region, difficulty) {
  const rows = [];

  for (const element of deterministicShuffle(elements, `${region.id}:${difficulty}`)) {
    if (element.type !== "way" || !Array.isArray(element.geometry) || element.geometry.length < 2) {
      continue;
    }

    const point = pickRepresentativePoint(
      element.geometry,
      element.id,
      element.candidateBbox ?? region.bbox,
    );
    const highway = element.tags?.highway ?? "road";
    const id = makeCandidateId(region.id, difficulty, element.id, point);

    rows.push({
      id,
      status: "candidate",
      title: `${region.name} ${difficultyLabel(difficulty)} 후보 도로`,
      lat: roundCoordinate(point.lat),
      lng: roundCoordinate(point.lon),
      region1: region.name,
      region2: null,
      difficulty,
      tags: makeTags(difficulty, highway),
      roadviewVerified: false,
      humanReviewed: false,
      gameEligible: false,
      source: {
        type: "openstreetmap_overpass",
        osmType: "way",
        osmId: element.id,
        highway,
        attribution: "© OpenStreetMap contributors",
        license: "ODbL 1.0"
      },
      reviewNotes: [],
      generatedAt: new Date().toISOString()
    });
  }

  return rows;
}

function pickRepresentativePoint(geometry, salt, bbox) {
  const inBounds = geometry.filter((point) => isInsideBbox(point, bbox));
  const candidates = inBounds.length > 0 ? inBounds : geometry;
  const offset = salt % candidates.length;
  const preferredIndex = Math.floor(candidates.length * 0.5);
  return candidates[(preferredIndex + offset) % candidates.length];
}

function isInsideBbox(point, bbox) {
  return (
    point.lat >= bbox.south &&
    point.lat <= bbox.north &&
    point.lon >= bbox.west &&
    point.lon <= bbox.east
  );
}

function makeCandidateId(regionId, difficulty, osmId, point) {
  return [
    "osm",
    regionId,
    difficulty,
    osmId,
    Math.round(point.lat * 100000),
    Math.round(point.lon * 100000),
  ].join("-");
}

function makeTags(difficulty, highway) {
  const tags = [`highway:${highway}`, "osm-candidate"];

  if (difficulty === "easy") {
    tags.push("clue-rich-road");
  } else if (difficulty === "medium") {
    tags.push("ordinary-road");
  } else {
    tags.push("low-clue-road");
  }

  return tags;
}

function difficultyLabel(difficulty) {
  return difficulty === "easy" ? "하" : difficulty === "medium" ? "중" : "상";
}

function selectSpacedCandidates(candidates, limit, minDistanceMeters) {
  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    const isFarEnough = selected.every(
      (item) => distanceMeters(item, candidate) >= minDistanceMeters,
    );
    if (isFarEnough) {
      selected.push(candidate);
    }
  }

  return selected;
}

function distanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
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

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}
