/**
 * `spec0 mcp install` — config-writing behaviour.
 *
 * These tests drive the built CLI via spawnSync (like the version-collision
 * suite) so we exercise the real command wiring. Each run gets a throwaway HOME
 * so `~/.cursor/mcp.json` and the `conf`-backed store land under a temp dir, not
 * the developer's real home.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const rootDir = process.cwd();
const cli = join(rootDir, "dist", "index.js");

const CANONICAL_MCP_URL = "https://api.spec0.io/mcp/sse";

let testHome: string;

beforeAll(() => {
  if (!existsSync(cli)) {
    throw new Error(
      `Built CLI not found at ${cli}. Run \`npm run build\` first (jest's \`pretest\` does this).`,
    );
  }
});

beforeEach(() => {
  testHome = mkdtempSync(join(tmpdir(), "spec0-cli-mcp-test-"));
});

afterEach(() => {
  if (testHome) rmSync(testHome, { recursive: true, force: true });
});

/** Run the CLI with HOME pinned to the per-test temp dir. `env` overrides the rest. */
function run(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync("node", [cli, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: testHome,
      SPEC0_MODE: "agent",
      // Keep the real env from leaking auth into the auth-missing case.
      SPEC0_TOKEN: undefined,
      SPEC0_ORG_ID: undefined,
      PLATFORM_API_TOKEN: undefined,
      PLATFORM_ORG_ID: undefined,
      ...env,
    },
  });
}

/** Auth env that satisfies `requireAuthOrExit` without needing a stored config. */
const AUTHED_ENV = {
  SPEC0_TOKEN: "test-token",
  SPEC0_ORG_ID: "00000000-0000-0000-0000-000000000000",
};

const cursorConfigPath = () => join(testHome, ".cursor", "mcp.json");

describe("spec0 mcp install --client cursor", () => {
  it("writes a valid ~/.cursor/mcp.json with the canonical url + Authorization header", () => {
    const r = run(["mcp", "install", "--client", "cursor"], AUTHED_ENV);
    expect(r.status).toBe(0);

    const path = cursorConfigPath();
    expect(existsSync(path)).toBe(true);

    const config = JSON.parse(readFileSync(path, "utf-8"));
    expect(config.mcpServers.spec0.url).toBe(CANONICAL_MCP_URL);
    expect(config.mcpServers.spec0.headers.Authorization).toBe("Bearer ${SPEC0_TOKEN}");
  });

  it("preserves an existing unrelated server already in the file", () => {
    const path = cursorConfigPath();
    mkdirSync(join(testHome, ".cursor"), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          mcpServers: {
            other: { command: "node", args: ["other-server.js"] },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const r = run(["mcp", "install", "--client", "cursor"], AUTHED_ENV);
    expect(r.status).toBe(0);

    const config = JSON.parse(readFileSync(path, "utf-8"));
    // Our server is added...
    expect(config.mcpServers.spec0.url).toBe(CANONICAL_MCP_URL);
    // ...and the pre-existing one is untouched.
    expect(config.mcpServers.other).toEqual({ command: "node", args: ["other-server.js"] });
  });

  it("respects SPEC0_MCP_URL override when writing the config", () => {
    const r = run(["mcp", "install", "--client", "cursor"], {
      ...AUTHED_ENV,
      SPEC0_MCP_URL: "https://staging.spec0.io/mcp/sse",
    });
    expect(r.status).toBe(0);

    const config = JSON.parse(readFileSync(cursorConfigPath(), "utf-8"));
    expect(config.mcpServers.spec0.url).toBe("https://staging.spec0.io/mcp/sse");
  });
});

describe("spec0 mcp install — auth", () => {
  it("exits 3 (AUTH_MISSING) when not authenticated", () => {
    // No SPEC0_TOKEN / stored config under the empty temp HOME.
    const r = run(["mcp", "install", "--client", "cursor"]);
    expect(r.status).toBe(3);
    expect(existsSync(cursorConfigPath())).toBe(false);
  });
});
