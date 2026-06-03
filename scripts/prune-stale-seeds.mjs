import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_REPORT_PATH =
  "data/seed-pipeline/runtime/roadview-recheck-report.json";
const DEFAULT_ISSUES_PATH = "data/seed-pipeline/runtime/seed-issues.json";
const DEFAULT_STALE_PATH = "data/seed-pipeline/runtime/stale-seeds.json";
const ALLOWED_STALE_STATUSES = new Set(["no_pano", "region_mismatch"]);
const DEFAULT_MAX_STALE_RATIO = 0.2;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const reportPath = toRepoPath(args.report ?? DEFAULT_REPORT_PATH);
const issuesPath = toRepoPath(args.issues ?? DEFAULT_ISSUES_PATH);
const stalePath = toRepoPath(args.out ?? DEFAULT_STALE_PATH);
const apply = args.apply === true || args.apply === "true";
const force = args.force === true || args.force === "true";
const maxStaleRatio = parseRatio(args["max-stale-ratio"], DEFAULT_MAX_STALE_RATIO);
const staleRows = [
  ...readStaleRowsFromReport(reportPath, {
    explicit: Boolean(args.report),
    force,
    maxStaleRatio,
  }),
  ...readStaleRowsFromIssues(issuesPath, Boolean(args.issues)),
];

if (staleRows.length === 0) {
  console.log("[seed:prune-stale] no stale rows found");
  process.exit(0);
}

const now = new Date().toISOString();
const existing = readStaleFile(stalePath);
const byId = new Map(existing.seeds.map((seed) => [seed.id, seed]));

for (const row of staleRows) {
  if (typeof row.id !== "string" || row.id.length === 0) {
    continue;
  }

  const current = byId.get(row.id);
  byId.set(row.id, {
    id: row.id,
    reason: row.reason,
    region1: row.region1 ?? null,
    region2: row.region2 ?? null,
    difficulty: row.difficulty ?? null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    firstReportedAt: current?.firstReportedAt ?? now,
    lastReportedAt: now,
    sourceReport: (row.sourcePath ?? reportPath).replace(`${ROOT_DIR}/`, ""),
  });
}

const nextFile = {
  generatedAt: existing.generatedAt ?? now,
  updatedAt: now,
  source:
    "Runtime seeds excluded after Kakao Roadview recheck found no panorama or region mismatch",
  seeds: [...byId.values()].sort((left, right) => left.id.localeCompare(right.id)),
};

console.log(
  `[seed:prune-stale] ${staleRows.length} stale rows from sources; ` +
    `${nextFile.seeds.length} total excluded seed ids`,
);

if (!apply) {
  console.log("[seed:prune-stale] dry-run only. Add --apply to write stale-seeds.json.");
  process.exit(0);
}

mkdirSync(dirname(stalePath), { recursive: true });
writeFileSync(stalePath, `${JSON.stringify(nextFile, null, 2)}\n`);
console.log(`[seed:prune-stale] wrote ${stalePath}`);

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`File does not exist: ${path}`);
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function toRepoPath(path) {
  return isAbsolute(path) ? path : join(ROOT_DIR, path);
}

function readStaleRowsFromReport(path, { explicit, force, maxStaleRatio }) {
  if (!existsSync(path)) {
    if (explicit) {
      throw new Error(`Report file does not exist: ${path}`);
    }

    return [];
  }

  const report = readJson(path);
  if (!Array.isArray(report.rows)) {
    throw new Error(`Roadview report must contain a rows array: ${path}`);
  }

  const staleRows = report.rows.filter((row) => {
    if (row.status === "ok") {
      return false;
    }

    if (!ALLOWED_STALE_STATUSES.has(row.status)) {
      throw new Error(`Unsupported stale row status "${row.status}" in ${path}`);
    }

    return true;
  });
  const staleRatio = report.rows.length > 0
    ? staleRows.length / report.rows.length
    : 0;

  if (!force && report.rows.length >= 100 && staleRatio > maxStaleRatio) {
    throw new Error(
      `Stale ratio ${(staleRatio * 100).toFixed(1)}% exceeds ${(maxStaleRatio * 100).toFixed(1)}%. ` +
        "Check Kakao SDK/geocoder health, or rerun with --force.",
    );
  }

  return staleRows.map((row) => ({
    id: row.id,
    reason: row.status,
    region1: row.region1 ?? null,
    region2: row.region2 ?? null,
    difficulty: row.difficulty ?? null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    sourcePath: path,
  }));
}

function readStaleRowsFromIssues(path, explicit) {
  if (!existsSync(path)) {
    if (explicit) {
      throw new Error(`Runtime issue file does not exist: ${path}`);
    }

    return [];
  }

  const parsed = readJson(path);
  const issues = Array.isArray(parsed) ? parsed : parsed.issues;
  if (!Array.isArray(issues)) {
    throw new Error(`Runtime issue file must contain an issues array: ${path}`);
  }

  return issues
    .filter((issue) => ALLOWED_STALE_STATUSES.has(issue.reason))
    .map((issue) => ({
      id: issue.seedId,
      reason: issue.reason,
      region1: issue.region1 ?? null,
      region2: issue.region2 ?? null,
      difficulty: issue.difficulty ?? null,
      lat: typeof issue.lat === "number" ? issue.lat : null,
      lng: typeof issue.lng === "number" ? issue.lng : null,
      sourcePath: path,
    }));
}

function readStaleFile(path) {
  if (!existsSync(path)) {
    return {
      generatedAt: null,
      seeds: [],
    };
  }

  const parsed = readJson(path);
  if (!Array.isArray(parsed.seeds)) {
    throw new Error(`Stale seed file must contain a seeds array: ${path}`);
  }

  return parsed;
}

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

function parseRatio(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error("--max-stale-ratio must be a number between 0 and 1");
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npm run seed:prune-stale -- --report data/seed-pipeline/runtime/roadview-recheck-report.json --apply

Options:
  --report <path>  roadview recheck JSON report
  --issues <path>  runtime seed issue JSON from the API server
  --out <path>     stale seed registry path
  --max-stale-ratio <0-1>
                  fail when a large recheck report has too many stale rows
  --force          bypass the stale ratio guard
  --apply          write stale-seeds.json
`);
}
