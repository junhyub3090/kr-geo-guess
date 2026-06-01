import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const TARGETS_PATH = join(ROOT_DIR, "data/seed-pipeline/region-targets.ko.json");
const CANDIDATES_DIR = join(ROOT_DIR, "data/seed-pipeline/candidates");
const COMPILED_RUNTIME_PATH = join(
  ROOT_DIR,
  "data/seed-pipeline/runtime/verified-seeds.json",
);
const DIFFICULTIES = ["easy", "medium", "hard"];
const STATUSES = ["candidate", "roadview_verified", "approved", "rejected"];

const targets = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
const { KOREA_SEED_CATALOG } = await import("../packages/shared/src/seeds.ts");
const compiledRuntimeCatalog = readJsonArray(COMPILED_RUNTIME_PATH);
const candidateRows = dedupeCandidateRows(readCandidateRows(CANDIDATES_DIR));

const rows = targets.regions.map((region) => {
  const manualRuntime = countByDifficulty(
    KOREA_SEED_CATALOG.filter((seed) => seed.region1 === region.name),
  );
  const compiledRuntime = countByDifficulty(
    compiledRuntimeCatalog.filter((seed) => seed.region1 === region.name),
  );
  const candidates = candidateRows.filter((row) => row.region1 === region.name);
  const stagedApproved = countByDifficulty(
    candidates.filter((row) => row.status === "approved"),
  );
  const statusCounts = countByStatus(candidates);

  return {
    id: region.id,
    name: region.name,
    targetApproved: region.targetApproved,
    manualRuntimeTotal: sumDifficulty(manualRuntime),
    manualRuntime,
    compiledRuntimeTotal: sumDifficulty(compiledRuntime),
    compiledRuntime,
    stagedApprovedTotal: sumDifficulty(stagedApproved),
    stagedApproved,
    candidateTotal: candidates.length,
    statusCounts,
    runtimeGap: Math.max(region.targetApproved - sumDifficulty(compiledRuntime), 0),
    approvedGap: Math.max(
      region.targetApproved -
        sumDifficulty(compiledRuntime) -
        sumDifficulty(stagedApproved),
      0,
    ),
  };
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
} else {
  printHumanReport(rows);
}

function countByDifficulty(items) {
  return Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      items.filter((item) => item.difficulty === difficulty).length,
    ]),
  );
}

function countByStatus(items) {
  return Object.fromEntries(
    STATUSES.map((status) => [
      status,
      items.filter((item) => item.status === status).length,
    ]),
  );
}

function sumDifficulty(counts) {
  return DIFFICULTIES.reduce((total, difficulty) => total + counts[difficulty], 0);
}

function readCandidateRows(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const rows = [];
  for (const filePath of walkFiles(rootDir)) {
    if (!filePath.endsWith(".jsonl")) {
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

function readJsonArray(path) {
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
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

function walkFiles(dir) {
  const entries = readdirSync(dir)
    .map((entry) => join(dir, entry))
    .sort();

  return entries.flatMap((entry) => {
    const stats = statSync(entry);
    return stats.isDirectory() ? walkFiles(entry) : [entry];
  });
}

function printHumanReport(rows) {
  console.log("KR Geo Guess seed pool audit");
  console.log("Compiled runtime = API가 우선 읽는 data/seed-pipeline/runtime/verified-seeds.json");
  console.log("Manual fallback = compiled runtime이 없을 때 쓰는 packages/shared/src/seeds.ts");
  console.log("Staged approved = JSONL 후보 중 approved지만 아직 런타임에 반영하지 않은 좌표");
  console.log("");
  console.log(
    [
      "지역",
      "목표",
      "컴파일런타임",
      "컴파일 난이도(e/m/h)",
      "수동fallback",
      "후보",
      "로드뷰확인",
      "제외",
      "승인대기",
      "남은 런타임",
      "남은 승인",
    ].join("\t"),
  );

  for (const row of rows) {
    console.log(
      [
        row.name,
        row.targetApproved,
        row.compiledRuntimeTotal,
        `${row.compiledRuntime.easy}/${row.compiledRuntime.medium}/${row.compiledRuntime.hard}`,
        row.manualRuntimeTotal,
        row.candidateTotal,
        row.statusCounts.roadview_verified,
        row.statusCounts.rejected,
        row.stagedApprovedTotal,
        row.runtimeGap,
        row.approvedGap,
      ].join("\t"),
    );
  }

  const totals = rows.reduce(
    (acc, row) => ({
      targetApproved: acc.targetApproved + row.targetApproved,
      compiledRuntimeTotal: acc.compiledRuntimeTotal + row.compiledRuntimeTotal,
      manualRuntimeTotal: acc.manualRuntimeTotal + row.manualRuntimeTotal,
      candidateTotal: acc.candidateTotal + row.candidateTotal,
      roadviewVerifiedTotal:
        acc.roadviewVerifiedTotal + row.statusCounts.roadview_verified,
      rejectedTotal: acc.rejectedTotal + row.statusCounts.rejected,
      stagedApprovedTotal: acc.stagedApprovedTotal + row.stagedApprovedTotal,
      runtimeGap: acc.runtimeGap + row.runtimeGap,
      approvedGap: acc.approvedGap + row.approvedGap,
    }),
    {
      targetApproved: 0,
      compiledRuntimeTotal: 0,
      manualRuntimeTotal: 0,
      candidateTotal: 0,
      roadviewVerifiedTotal: 0,
      rejectedTotal: 0,
      stagedApprovedTotal: 0,
      runtimeGap: 0,
      approvedGap: 0,
    },
  );

  console.log("");
  console.log(
    `합계: 목표 ${totals.targetApproved}, 컴파일런타임 ${totals.compiledRuntimeTotal}, 수동fallback ${totals.manualRuntimeTotal}, 후보 ${totals.candidateTotal}, 로드뷰확인 ${totals.roadviewVerifiedTotal}, 제외 ${totals.rejectedTotal}, 승인대기 ${totals.stagedApprovedTotal}, 런타임 부족 ${totals.runtimeGap}, 승인 부족 ${totals.approvedGap}`,
  );
}
