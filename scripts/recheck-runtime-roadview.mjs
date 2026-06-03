import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_APP_URL = "http://127.0.0.1:5173/";
const DEFAULT_RADIUS_METERS = 80;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_DELAY_MS = 250;
const DEFAULT_INPUT_PATH = "data/seed-pipeline/runtime/verified-seeds.json";
const DEFAULT_OUTPUT_PATH = "data/seed-pipeline/runtime/roadview-recheck-report.json";
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const inputPath = join(ROOT_DIR, args.in ?? DEFAULT_INPUT_PATH);
const outputPath = join(ROOT_DIR, args.out ?? DEFAULT_OUTPUT_PATH);
const appUrl = args.url ?? DEFAULT_APP_URL;
const radiusMeters = parsePositiveInt(args.radius, DEFAULT_RADIUS_METERS);
const batchSize = parsePositiveInt(args["batch-size"], DEFAULT_BATCH_SIZE);
const delayMs = parseNonNegativeInt(args["delay-ms"], DEFAULT_DELAY_MS);
const limit = args.limit ? parsePositiveInt(args.limit, 0) : null;
const regionFilter = args.region ? String(args.region) : null;
const difficultyFilter = args.difficulty ? String(args.difficulty) : null;
const failOnStale = args["fail-on-stale"] === true || args["fail-on-stale"] === "true";
const appKey = process.env.VITE_KAKAO_MAP_JS_KEY ?? readEnvValue("VITE_KAKAO_MAP_JS_KEY");
const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));

if (!appKey) {
  throw new Error("VITE_KAKAO_MAP_JS_KEY is missing. Add it to .env first.");
}

const seeds = readRuntimeSeeds(inputPath)
  .filter((seed) => !regionFilter || seed.region1 === regionFilter || seed.region2 === regionFilter)
  .filter((seed) => !difficultyFilter || seed.difficulty === difficultyFilter)
  .slice(0, limit ?? undefined);

if (seeds.length === 0) {
  throw new Error(`No runtime seeds selected from ${inputPath}`);
}

console.log(
  `[roadview:recheck] started ${seeds.length} runtime checks, radius ${radiusMeters}m`,
);
console.log(`[roadview:recheck] browser origin ${appUrl}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await loadKakaoSdk(page, appKey);

  const rows = [];
  let checked = 0;

  for (let index = 0; index < seeds.length; index += batchSize) {
    const batch = seeds.slice(index, index + batchSize);
    const results = await page.evaluate(
      async ({ batchRows, radius }) => {
        const maps = window.kakao.maps;
        const client = new maps.RoadviewClient();
        const geocoder = maps.services ? new maps.services.Geocoder() : null;

        async function check(seed) {
          const position = new maps.LatLng(seed.lat, seed.lng);
          const hasNearestPano = await new Promise((resolve) => {
            client.getNearestPanoId(position, radius, (panoId) => {
              resolve(Boolean(panoId));
            });
          });
          const regionResult = geocoder
            ? await new Promise((resolve) => {
                geocoder.coord2RegionCode(seed.lng, seed.lat, (results, status) => {
                  if (status !== maps.services.Status.OK || !Array.isArray(results)) {
                    resolve({ ok: false, region1: null, region2: null, status });
                    return;
                  }

                  const administrative = results.find(
                    (result) => result.region_type === "H",
                  ) ?? results[0];

                  resolve({
                    ok: true,
                    region1: administrative?.region_1depth_name ?? null,
                    region2: administrative?.region_2depth_name ?? null,
                    status,
                  });
                });
              })
            : { ok: false, region1: null, region2: null, status: "services_missing" };
          const regionVerified = seed.expectedRegion1Names.includes(regionResult.region1);
          const status = hasNearestPano && regionVerified
            ? "ok"
            : hasNearestPano
              ? "region_mismatch"
              : "no_pano";

          return {
            id: seed.id,
            region1: seed.region1,
            region2: seed.region2,
            difficulty: seed.difficulty,
            lat: seed.lat,
            lng: seed.lng,
            status,
            roadviewVerified: hasNearestPano,
            regionVerified,
            kakaoRegion: regionResult,
            storesProviderImages: false,
            storesProviderPanoIds: false,
          };
        }

        const output = [];
        for (const seed of batchRows) {
          output.push(await check(seed));
        }
        return output;
      },
      {
        batchRows: batch.map((seed) => withExpectedRegion(seed, targets)),
        radius: radiusMeters,
      },
    );

    rows.push(...results);
    checked += results.length;
    const stale = rows.filter((row) => row.status !== "ok").length;
    console.log(
      `[roadview:recheck] ${checked}/${seeds.length} checked, stale ${stale}`,
    );

    if (delayMs > 0 && checked < seeds.length) {
      await delay(delayMs);
    }
  }

  const summary = summarize(rows);
  const report = {
    generatedAt: new Date().toISOString(),
    source: "runtime seed recheck by Kakao Roadview availability and Kakao region reverse geocoding",
    input: args.in ?? DEFAULT_INPUT_PATH,
    radiusMeters,
    storesProviderImages: false,
    storesProviderPanoIds: false,
    summary,
    rows,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `[roadview:recheck] wrote report to ${outputPath}; ok ${summary.ok}, stale ${summary.stale}`,
  );

  if (failOnStale && summary.stale > 0) {
    process.exitCode = 2;
  }
} finally {
  await browser.close();
}

function summarize(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.checked += 1;
      summary[row.status] += 1;
      if (row.status !== "ok") {
        summary.stale += 1;
      }
      return summary;
    },
    {
      checked: 0,
      ok: 0,
      no_pano: 0,
      region_mismatch: 0,
      stale: 0,
    },
  );
}

function withExpectedRegion(seed, targets) {
  const region = targets.regions.find((item) => item.name === seed.region1);
  return {
    ...seed,
    expectedRegion1Names: region?.kakaoRegion1Names ?? [seed.region1],
  };
}

function readRuntimeSeeds(path) {
  if (!existsSync(path)) {
    throw new Error(`Runtime seed file does not exist: ${path}`);
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Runtime seed file must be a JSON array: ${path}`);
  }

  return parsed;
}

async function loadKakaoSdk(page, appKey) {
  await page.evaluate(async (key) => {
    if (!window.kakao?.maps) {
      await new Promise((resolve, reject) => {
        const existingScript = document.querySelector("script[data-kakao-roadview-verifier]");
        if (existingScript) {
          existingScript.addEventListener("load", resolve, { once: true });
          existingScript.addEventListener("error", reject, { once: true });
          return;
        }

        const script = document.createElement("script");
        script.dataset.kakaoRoadviewVerifier = "true";
        script.async = true;
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=${encodeURIComponent(
          key,
        )}`;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
        document.head.appendChild(script);
      });
    }

    await new Promise((resolve) => window.kakao.maps.load(resolve));
  }, appKey);
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

function printHelp() {
  console.log(`Usage:
  npm run seed:recheck-roadview

Options:
  --in             runtime seed JSON path, default ${DEFAULT_INPUT_PATH}
  --out            output report JSON path, default ${DEFAULT_OUTPUT_PATH}
  --url            registered Kakao JS origin, default ${DEFAULT_APP_URL}
  --radius         RoadviewClient search radius meters, default ${DEFAULT_RADIUS_METERS}
  --batch-size     rows per progress batch, default ${DEFAULT_BATCH_SIZE}
  --delay-ms       delay between batches, default ${DEFAULT_DELAY_MS}
  --limit          recheck only the first N selected rows
  --region         filter by region1 or region2
  --difficulty     filter by easy | medium | hard
  --fail-on-stale  exit with code 2 when any selected seed is stale
`);
}

function readEnvValue(name) {
  const envPath = join(ROOT_DIR, ".env");
  if (!existsSync(envPath)) {
    return "";
  }

  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((entry) => entry.trim().startsWith(`${name}=`));

  if (!line) {
    return "";
  }

  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
