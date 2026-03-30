/**
 * Non-blocking update check against npm registry.
 * Caches the result for 24 hours in ~/.spec0/config.json.
 * Only runs in interactive (non-CI) terminals.
 */

import chalk from "chalk";
import Conf from "conf";

interface UpdateStore {
  lastCheck: number;
  latestVersion: string;
}

const store = new Conf<UpdateStore>({
  projectName: "spec0-update",
  defaults: { lastCheck: 0, latestVersion: "" },
});

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

export function isNewer(candidate: string, current: string): boolean {
  const c = candidate.split(".").map(Number);
  const v = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) > (v[i] ?? 0)) return true;
    if ((c[i] ?? 0) < (v[i] ?? 0)) return false;
  }
  return false;
}

function shouldSkip(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    !process.stdout.isTTY
  );
}

/**
 * Prints an update notice if a newer version was cached from the last check.
 * Then fires a background fetch to refresh the cache (fire-and-forget).
 */
export function notifyUpdateIfAvailable(currentVersion: string): void {
  if (shouldSkip()) return;

  const cached = store.get("latestVersion");
  if (cached && isNewer(cached, currentVersion)) {
    process.stderr.write(
      "\n" +
        chalk.yellow(`  Update available: `) +
        chalk.bold(`${currentVersion} → ${cached}`) +
        "\n" +
        chalk.gray(`  Run `) +
        chalk.cyan(`npm install -g @spec0/cli`) +
        chalk.gray(` to update\n`) +
        "\n"
    );
  }

  const now = Date.now();
  const lastCheck = store.get("lastCheck", 0);
  if (now - lastCheck < CHECK_INTERVAL_MS) return;

  // Fire-and-forget background fetch
  store.set("lastCheck", now);
  fetch("https://registry.npmjs.org/@spec0/cli/latest", {
    signal: AbortSignal.timeout(3000),
  })
    .then((r) => r.json())
    .then((data) => {
      const latest = (data as { version?: string }).version;
      if (latest) store.set("latestVersion", latest);
    })
    .catch(() => {});
}
