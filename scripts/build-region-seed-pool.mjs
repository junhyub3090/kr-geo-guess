import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");
const PROGRESS_PATH = join(ROOT_DIR, "data/seed-pipeline/pipeline-progress.json");
const DIFFICULTIES = ["easy", "medium", "hard"];

const args = parseArgs(process.argv.slice(2));
const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
const selectedRegions =
  args.region && args.region !== "all"
    ? targets.regions.filter((region) => region.id === args.region || region.name === args.region)
    : targets.regions;
const rawMultiplier = Number.parseFloat(args["raw-multiplier"] ?? "1.35");
const tiles = Number.parseInt(args.tiles ?? "3", 10);
const tileDelayMs = Number.parseInt(args["tile-delay-ms"] ?? "6000", 10);
const maxRetries = Number.parseInt(args["max-retries"] ?? "6", 10);
const forceCandidates = args["force-candidates"] === true || args["force-candidates"] === "true";
const forceRoadview = args["force-roadview"] === true || args["force-roadview"] === "true";

if (selectedRegions.length === 0) {
  throw new Error(`No region matched: ${args.region}`);
}

mkdirSync(join(ROOT_DIR, "data/seed-pipeline/candidates"), { recursive: true });

const startedAt = new Date().toISOString();
writeProgress({
  status: "running",
  startedAt,
  updatedAt: startedAt,
  regions: selectedRegions.map((region) => region.id),
  current: null,
  completedTasks: 0,
  totalTasks: selectedRegions.length * DIFFICULTIES.length * 2,
});

let completedTasks = 0;
const failures = [];

for (const region of selectedRegions) {
  for (const difficulty of DIFFICULTIES) {
    const target = region.difficultyTargets[difficulty];
    const rawLimit = Math.ceil(target * rawMultiplier);
    const rawPath = `data/seed-pipeline/candidates/${region.id}-${difficulty}.jsonl`;
    const verifiedPath = `data/seed-pipeline/candidates/${region.id}-${difficulty}.roadview.jsonl`;

    updateCurrent("candidate", region, difficulty, completedTasks);
    if (forceCandidates || countRows(rawPath) < rawLimit) {
      const candidateOk = await runTask("candidate", region, difficulty, () =>
        run("npm", [
          "run",
          "seed:candidates",
          "--",
          "--region",
          region.id,
          "--difficulty",
          difficulty,
          "--limit",
          String(rawLimit),
          "--tiles",
          String(tiles),
          "--tile-delay-ms",
          String(tileDelayMs),
          "--max-retries",
          String(maxRetries),
          "--out",
          rawPath,
        ]),
      );
      if (!candidateOk) {
        completedTasks += 2;
        updateCurrent("failed", region, difficulty, completedTasks);
        continue;
      }
    } else {
      console.log(`[pipeline] skip candidates ${region.name}/${difficulty}; ${countRows(rawPath)} rows already exist`);
    }
    completedTasks += 1;

    updateCurrent("roadview", region, difficulty, completedTasks);
    if (forceRoadview || countVerifiedRows(verifiedPath) < target) {
      await runTask("roadview", region, difficulty, () =>
        run("npm", [
          "run",
          "seed:roadview",
          "--",
          "--in",
          rawPath,
          "--out",
          verifiedPath,
          "--batch-size",
          "20",
          "--delay-ms",
          "250",
          "--verify-region",
          "true",
          "--stop-after-verified",
          String(target),
        ]),
      );
    } else {
      console.log(`[pipeline] skip roadview ${region.name}/${difficulty}; ${countVerifiedRows(verifiedPath)} verified rows already exist`);
    }
    completedTasks += 1;
    updateCurrent("completed", region, difficulty, completedTasks);
  }
}

writeProgress({
  status: failures.length > 0 ? "complete_with_failures" : "complete",
  startedAt,
  updatedAt: new Date().toISOString(),
  regions: selectedRegions.map((region) => region.id),
  current: null,
  completedTasks,
  totalTasks: selectedRegions.length * DIFFICULTIES.length * 2,
  failures,
});

console.log(failures.length > 0 ? "[pipeline] complete with failures" : "[pipeline] complete");

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

function countRows(relativePath) {
  const absolutePath = join(ROOT_DIR, relativePath);
  if (!existsSync(absolutePath)) {
    return 0;
  }

  const content = readFileSync(absolutePath, "utf8").trim();
  return content ? content.split("\n").length : 0;
}

function countVerifiedRows(relativePath) {
  const absolutePath = join(ROOT_DIR, relativePath);
  if (!existsSync(absolutePath)) {
    return 0;
  }

  const content = readFileSync(absolutePath, "utf8").trim();
  if (!content) {
    return 0;
  }

  return content
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((row) => row.status === "roadview_verified" && row.roadviewVerified && row.regionVerified === true)
    .length;
}

function updateCurrent(stage, region, difficulty, completedTaskCount) {
  writeProgress({
    status: "running",
    startedAt,
    updatedAt: new Date().toISOString(),
    regions: selectedRegions.map((item) => item.id),
    current: {
      stage,
      regionId: region.id,
      regionName: region.name,
      difficulty,
    },
    completedTasks: completedTaskCount,
    totalTasks: selectedRegions.length * DIFFICULTIES.length * 2,
    failures,
  });
}

function writeProgress(progress) {
  writeFileSync(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`);
}

function run(command, commandArgs) {
  console.log(`[pipeline] run ${command} ${commandArgs.join(" ")}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT_DIR,
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} failed with ${code}`));
    });
  });
}

async function runTask(stage, region, difficulty, task) {
  try {
    await task();
    return true;
  } catch (error) {
    const failure = {
      stage,
      regionId: region.id,
      regionName: region.name,
      difficulty,
      message: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
    };
    failures.push(failure);
    console.error(`[pipeline] failed ${region.name}/${difficulty}/${stage}: ${failure.message}`);
    return false;
  }
}
