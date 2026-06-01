import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_APP_URL = "http://127.0.0.1:5173/";
const DEFAULT_RADIUS_METERS = 50;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_DELAY_MS = 250;
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.in) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const inputPath = join(ROOT_DIR, args.in);
const outputPath = join(
  ROOT_DIR,
  args.out ?? args.in.replace(/\.jsonl$/, ".roadview.jsonl"),
);
const appUrl = args.url ?? DEFAULT_APP_URL;
const radiusMeters = parsePositiveInt(args.radius, DEFAULT_RADIUS_METERS);
const batchSize = parsePositiveInt(args["batch-size"], DEFAULT_BATCH_SIZE);
const delayMs = parseNonNegativeInt(args["delay-ms"], DEFAULT_DELAY_MS);
const limit = args.limit ? parsePositiveInt(args.limit, 0) : null;
const stopAfterVerified = args["stop-after-verified"]
  ? parsePositiveInt(args["stop-after-verified"], 0)
  : null;
const verifyRegion = args["verify-region"] !== false && args["verify-region"] !== "false";
const appKey = process.env.VITE_KAKAO_MAP_JS_KEY ?? readEnvValue("VITE_KAKAO_MAP_JS_KEY");
const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));

if (!appKey) {
  throw new Error("VITE_KAKAO_MAP_JS_KEY is missing. Add it to .env first.");
}

const rows = readJsonl(inputPath).slice(0, limit ?? undefined);

if (rows.length === 0) {
  throw new Error(`No candidate rows found in ${inputPath}`);
}

console.log(
  `[roadview] started ${rows.length} checks from ${args.in}, radius ${radiusMeters}m`,
);
console.log(`[roadview] browser origin ${appUrl}`);
console.log(`[roadview] region verification ${verifyRegion ? "enabled" : "disabled"}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await loadKakaoSdk(page, appKey);

  const verifiedRows = [];
  let checked = 0;
  let verified = 0;
  let rejected = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const results = await page.evaluate(
      async ({ batchRows, radius }) => {
        const maps = window.kakao.maps;
        const client = new maps.RoadviewClient();
        const geocoder = maps.services ? new maps.services.Geocoder() : null;

        async function check(row) {
          const position = new maps.LatLng(row.lat, row.lng);
          const hasNearestPano = await new Promise((resolve) => {
            client.getNearestPanoId(position, radius, (panoId) => {
              resolve(Boolean(panoId));
            });
          });
          const regionResult = geocoder
            ? await new Promise((resolve) => {
                geocoder.coord2RegionCode(row.lng, row.lat, (results, status) => {
                  if (status !== maps.services.Status.OK || !Array.isArray(results)) {
                    resolve({ ok: false, region1: null, status });
                    return;
                  }

                  const administrative = results.find(
                    (result) => result.region_type === "H",
                  ) ?? results[0];

                  resolve({
                    ok: true,
                    region1: administrative?.region_1depth_name ?? null,
                    region2: administrative?.region_2depth_name ?? null,
                    status
                  });
                });
              })
            : { ok: false, region1: null, region2: null, status: "services_missing" };
          const expectedRegionNames = row.expectedRegion1Names ?? [row.region1];
          const regionVerified = !row.verifyRegion || expectedRegionNames.includes(regionResult.region1);
          const accepted = hasNearestPano && regionVerified;

          return {
            ...row,
            status: accepted ? "roadview_verified" : "rejected",
            roadviewVerified: hasNearestPano,
            regionVerified,
            gameEligible: false,
            kakaoRoadview: {
              checkedAt: new Date().toISOString(),
              radiusMeters: radius,
              hasNearestPano,
              storedImage: false,
              storedPanoId: false
            },
            kakaoRegion: regionResult,
            reviewNotes: makeReviewNotes(row, hasNearestPano, regionVerified, regionResult)
          };
        }

        function makeReviewNotes(row, hasNearestPano, regionVerified, regionResult) {
          const notes = [...(row.reviewNotes ?? [])];
          notes.push(hasNearestPano ? "roadview_exists" : "no_roadview_within_radius");
          if (row.verifyRegion) {
            notes.push(
              regionVerified
                ? `region_verified:${regionResult.region1}`
                : `region_mismatch:${regionResult.region1 ?? "unknown"}`,
            );
          }
          return notes;
        }

        const output = [];
        for (const row of batchRows) {
          output.push(await check(row));
        }
        return output;
      },
      {
        batchRows: batch.map((row) => withExpectedRegion(row, targets, verifyRegion)),
        radius: radiusMeters
      },
    );

    for (const result of results) {
      verifiedRows.push(result);
      checked += 1;
      if (result.status === "roadview_verified") {
        verified += 1;
      } else {
        rejected += 1;
      }
    }

    console.log(
      `[roadview] ${checked}/${rows.length} checked, verified ${verified}, rejected ${rejected}`,
    );

    if (delayMs > 0 && checked < rows.length) {
      await delay(delayMs);
    }

    if (stopAfterVerified !== null && verified >= stopAfterVerified) {
      console.log(
        `[roadview] stop-after-verified reached ${verified}/${stopAfterVerified}`,
      );
      break;
    }
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, verifiedRows.map((row) => JSON.stringify(row)).join("\n") + "\n");

  console.log(`[roadview] wrote ${verifiedRows.length} rows to ${outputPath}`);
} finally {
  await browser.close();
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
  npm run seed:roadview -- --in data/seed-pipeline/candidates/seoul-easy.jsonl

Options:
  --in             input JSONL path, required
  --out            output JSONL path, defaults to input .roadview.jsonl
  --url            registered Kakao JS origin, default ${DEFAULT_APP_URL}
  --radius         RoadviewClient search radius meters, default ${DEFAULT_RADIUS_METERS}
  --batch-size     rows per progress batch, default ${DEFAULT_BATCH_SIZE}
  --delay-ms       delay between batches, default ${DEFAULT_DELAY_MS}
  --limit          verify only the first N rows
  --stop-after-verified stop once this many accepted rows are found
  --verify-region  verify Kakao region_1depth_name against the candidate region, default true
`);
}

function withExpectedRegion(row, targets, verifyRegion) {
  const region = targets.regions.find((item) => item.name === row.region1);
  return {
    ...row,
    verifyRegion,
    expectedRegion1Names: region?.kakaoRegion1Names ?? [row.region1],
  };
}

function readJsonl(path) {
  if (!existsSync(path)) {
    throw new Error(`Input file does not exist: ${path}`);
  }

  const content = readFileSync(path, "utf8").trim();
  if (!content) {
    return [];
  }

  return content.split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${path}:${index + 1} JSONL parse failed: ${error.message}`);
    }
  });
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
