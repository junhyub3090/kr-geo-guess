import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "apps/web/dist/assets");
const maxInitialJsBytes = 500 * 1024;

const assets = await readdir(assetsDir);
const jsAssets = assets.filter((asset) => asset.endsWith(".js"));
const boundaryJsonAssets = assets.filter((asset) =>
  /^skorea_municipalities_geo_simple-.*\.json$/.test(asset),
);

if (jsAssets.length === 0) {
  throw new Error("No web JS assets found. Run the production build first.");
}

const jsSizes = await Promise.all(
  jsAssets.map(async (asset) => ({
    asset,
    size: (await stat(join(assetsDir, asset))).size,
  })),
);
const largestJs = jsSizes.reduce((largest, current) =>
  current.size > largest.size ? current : largest,
);

if (largestJs.size > maxInitialJsBytes) {
  throw new Error(
    `Largest JS asset is too large: ${largestJs.asset} ${formatBytes(largestJs.size)} > ${formatBytes(maxInitialJsBytes)}`,
  );
}

if (boundaryJsonAssets.length !== 1) {
  throw new Error(
    `Expected one lazily loaded boundary JSON asset, found ${boundaryJsonAssets.length}.`,
  );
}

console.log(
  `Web build performance OK: largest JS ${largestJs.asset} ${formatBytes(largestJs.size)}, boundary JSON ${boundaryJsonAssets[0]}`,
);

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
