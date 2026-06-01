import { spawn } from "node:child_process";

const steps = [
  ["Unit tests", "npm", ["test"]],
  ["Typecheck", "npm", ["run", "typecheck"]],
  ["Production build", "npm", ["run", "build"]],
  ["Web build performance", "node", ["scripts/assert-web-build-performance.mjs"]],
  ["Browser QA", "npm", ["run", "test:e2e"]],
];

for (const [label, command, args] of steps) {
  console.log(`\n== ${label} ==`);
  await run(command, args);
}

console.log("\nQA complete.");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}
