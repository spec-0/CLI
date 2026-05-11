/**
 * Shared helper for integration tests that drive the built CLI as a subprocess.
 *
 * This is the same `spawnSync('node', [cli, ...args], …)` pattern used in
 * `test/version-flag-collision.test.ts`, lifted out so every staging
 * integration test under `test/integration/` reuses the same wiring.
 *
 * Resolves the CLI entry point relative to the repo root (`dist/index.js`) so
 * tests can be run from any cwd. Caller is responsible for passing the staging
 * env (`SPEC0_API_URL`, `SPEC0_ORG_ID`, `SPEC0_TOKEN`) via `opts.env`.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface RunCliOptions {
  /** Extra/overriding env vars merged on top of `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Working directory for the subprocess. Defaults to the repo root. */
  cwd?: string;
  /** Pipe `stdin` content (rare; most tests don't need this). */
  input?: string;
  /** Spawn timeout in ms. Default: 30 s — bumped over the unit-test default
   *  because integration tests hit the network. */
  timeoutMs?: number;
}

export interface RunCliResult {
  status: number | null;
  stdout: string;
  stderr: string;
  signal: NodeJS.Signals | null;
}

/** Locate the built CLI entry. Throws a clear error if `npm run build` was skipped. */
function resolveCliEntry(): string {
  // jest runs with cwd === repo root by convention, but be defensive.
  const fromCwd = resolve(process.cwd(), "dist", "index.js");
  if (existsSync(fromCwd)) return fromCwd;
  // Fall back to walking up from this file (works when invoked from anywhere).
  const fromHere = resolve(__dirname, "..", "..", "dist", "index.js");
  if (existsSync(fromHere)) return fromHere;
  throw new Error(
    `Built CLI not found at ${fromCwd} or ${fromHere}. ` +
      "Run `npm run build` first (the `pretest` script does this automatically for `npm test`).",
  );
}

/**
 * Spawn `node dist/index.js <args>` synchronously and return the captured
 * status / stdout / stderr.
 *
 * Default env additions match `version-flag-collision.test.ts`:
 *   - `SPEC0_MODE=agent`     — silences the update-check banner so stdout is deterministic.
 *   - `SPEC0_CLI_GIT_REF=""` — same.
 * Caller-supplied `env` keys override these.
 */
export function runCli(args: string[], options: RunCliOptions = {}): RunCliResult {
  const cli = resolveCliEntry();
  const result: SpawnSyncReturns<string> = spawnSync("node", [cli, ...args], {
    encoding: "utf8",
    cwd: options.cwd,
    input: options.input,
    timeout: options.timeoutMs ?? 30_000,
    env: {
      ...process.env,
      SPEC0_MODE: "agent",
      SPEC0_CLI_GIT_REF: "",
      ...(options.env ?? {}),
    },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal,
  };
}

export { resolveCliEntry };
export const CLI_ENTRY_REL = join("dist", "index.js");
