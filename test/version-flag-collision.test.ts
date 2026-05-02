/**
 * Regression: the program-level `--version` option (which prints the CLI version)
 * collided with subcommand options that take a `--version <value>` argument
 * (e.g. `spec0 publish --version 1.0.0`). Without `enablePositionalOptions()`
 * on the program builder, Commander parses every option in argv at the program
 * level first — even ones that appear after the subcommand name — so it would
 * print the CLI's own version and exit 0, never running the subcommand.
 *
 * These tests pin the contract:
 *   - root `--version` and `-V` still print the CLI version.
 *   - subcommand `--version <value>` works in both space and equals forms.
 *   - the required-flag check still fires when `--version` is omitted.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const rootDir = process.cwd();
const cli = join(rootDir, "dist", "index.js");

/** Minimal valid OpenAPI spec — enough to satisfy `spec0 publish --skip-lint --dry-run`. */
const SAMPLE_SPEC = `openapi: 3.0.3
info:
  title: Sample
  version: 0.0.1
paths: {}
`;

let scratchDir: string;
let specPath: string;

beforeAll(() => {
  if (!existsSync(cli)) {
    throw new Error(
      `Built CLI not found at ${cli}. Run \`npm run build\` before this test (jest's \`pretest\` script does this automatically).`,
    );
  }
  scratchDir = mkdtempSync(join(tmpdir(), "spec0-cli-version-test-"));
  specPath = join(scratchDir, "spec.yaml");
  writeFileSync(specPath, SAMPLE_SPEC, "utf8");
});

afterAll(() => {
  if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
});

function run(args: string[]) {
  return spawnSync("node", [cli, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      // Suppress the update-check banner so stdout is deterministic.
      SPEC0_MODE: "agent",
      SPEC0_CLI_GIT_REF: "",
      // `spec0 publish` resolves an auth context even on --dry-run (it short-circuits
      // before the network call but after `requireOrgContext`). Provide fake env vars
      // so we exercise the flag-parsing path without the auth-missing exit (code 3).
      SPEC0_TOKEN: "test-token",
      SPEC0_ORG_ID: "00000000-0000-0000-0000-000000000000",
      SPEC0_API_URL: "https://example.invalid",
    },
  });
}

describe("--version flag does not collide between program and subcommands", () => {
  it("`spec0 --version` prints the CLI version", () => {
    const r = run(["--version"]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("`spec0 -V` prints the CLI version", () => {
    const r = run(["-V"]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("`spec0 publish --version <value>` (space form) runs publish, not the version printer", () => {
    const r = run([
      "publish",
      specPath,
      "--name",
      "regression-fixture",
      "--skip-lint",
      "--dry-run",
      "--version",
      "1.0.0",
    ]);
    expect(r.status).toBe(0);
    // The publish dry-run announces the resolved version; the version printer would
    // emit only the bare CLI semver.
    expect(r.stdout).toMatch(/Dry run/);
    expect(r.stdout).toMatch(/version=1\.0\.0/);
  });

  it("`spec0 publish --version=<value>` (equals form) also runs publish", () => {
    const r = run([
      "publish",
      specPath,
      "--name",
      "regression-fixture",
      "--skip-lint",
      "--dry-run",
      "--version=1.0.0",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Dry run/);
    expect(r.stdout).toMatch(/version=1\.0\.0/);
  });

  it("`spec0 publish` without --version still surfaces the required-option error", () => {
    const r = run([
      "publish",
      specPath,
      "--name",
      "regression-fixture",
      "--skip-lint",
      "--dry-run",
    ]);
    expect(r.status).not.toBe(0);
    // Commander prints the required-option error to stderr.
    expect(r.stderr).toMatch(/required option '--version/);
  });
});
