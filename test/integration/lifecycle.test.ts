/**
 * Staging integration: full team-scoped CLI lifecycle journey.
 *
 * Provisions a team → pushes an API into it → creates a mock for it →
 * exercises the CLI's read/write surface against those resources → tears
 * everything down.
 *
 * Skipped automatically when staging env vars are missing (see staging-env.ts).
 * The default `npm test` excludes `test/integration/`; runs only via
 * `npm run test:integration` or the `staging-integration.yml` workflow.
 *
 * Coverage in order of execution:
 *   - team create        (via SDK directly; no CLI command exists yet)
 *   - spec0 push --team  (publishes a team-scoped API)
 *   - spec0 status       (org overview reflects the new resources)
 *   - spec0 api list     (catalogue lists the new API)
 *   - spec0 mock create  (provisions mock for the API)
 *   - spec0 mock list    (sees the new mock)
 *   - spec0 mock show    (finds it by slug)
 *   - spec0 mock url     (single-line URL)
 *   - spec0 push v2      (publishes a second version)
 *   - spec0 api changelog v1 → v2  (structured diff between versions)
 *   - spec0 api show     (details for the API)
 *   - spec0 mock delete  (CLI-driven teardown; mock disappears from list)
 *   - spec0 api delete   (CLI-driven teardown; API disappears from list)
 *
 * Cleanup: steps 11–12 delete the mock + API via the CLI. afterAll deletes the
 * (now-empty) team and acts as a best-effort SDK safety net for the mock/API if
 * an earlier step failed before its CLI delete ran. Each cleanup step swallows
 * errors so a failure mid-test doesn't mask the original failure.
 *
 * Per-run unique slugs (`Date.now()`) so concurrent or re-run executions don't
 * collide. Each cleanup step swallows errors so a failure mid-test doesn't
 * mask the original failure.
 */
import {
  OpenAPI,
  PublicApisService,
  PublicMocksService,
  PublicTeamsService,
} from "@spec0/sdk-public-platform";
import { runCli } from "./runCli";
import { stagingEnv, stagingEnvAsRecord, STAGING_ENV_AVAILABLE } from "./staging-env";

const MINIMAL_SPEC_V1 = `openapi: 3.0.3
info:
  title: CLI Lifecycle Integration
  version: 0.1.0
  description: Throw-away spec used by the @spec0/cli lifecycle integration test.
paths:
  /ping:
    get:
      summary: Liveness probe
      operationId: getPing
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
`;

const MINIMAL_SPEC_V2 = `openapi: 3.0.3
info:
  title: CLI Lifecycle Integration
  version: 0.2.0
  description: Throw-away spec used by the @spec0/cli lifecycle integration test (v2).
paths:
  /ping:
    get:
      summary: Liveness probe
      operationId: getPing
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
                  buildId:
                    type: string
`;

interface MockListJsonRow {
  api: string;
  name: string;
  mockUrl: string;
}

interface MockCreateJsonOutput {
  apiId?: string;
  apiName?: string;
  mockUrl: string;
  apiKey?: string | null;
  created?: boolean;
}

interface MockShowJsonOutput {
  apiId?: string;
  apiName?: string;
  mockServerId?: string;
  name?: string;
  mockUrl: string;
}

interface ApiListJsonRow {
  apiId?: string;
  apiName?: string;
  version?: string | null;
  teamName?: string | null;
}

interface PushJsonOutput {
  apiId?: string;
  apiName?: string;
  version?: string;
  teamName?: string | null;
  created?: boolean;
  versionCreated?: boolean;
}

function configureSdkForStaging(): void {
  // Mirrors `configureSdkAuth` in src/lib/api-client.ts — same path that the
  // CLI sets up for its own SDK calls.
  OpenAPI.BASE = `${stagingEnv.apiUrl}/api-management`;
  OpenAPI.TOKEN = stagingEnv.token;
  OpenAPI.HEADERS = { "X-Org-Id": stagingEnv.orgId };
}

const describeFn = STAGING_ENV_AVAILABLE ? describe : describe.skip;

describeFn("staging integration: full team-scoped CLI lifecycle", () => {
  // Per-run unique. Date.now() ms is enough — workflow is manual-trigger.
  const stamp = Date.now();
  const teamSlug = `cli-lc-team-${stamp}`;
  const apiSlug = `cli-lc-api-${stamp}`;

  let teamId: string | undefined;
  let apiId: string | undefined;
  let mockServerId: string | undefined;

  // Write the v1 spec to a tmp file so `spec0 push <path>` resolves a real
  // file. Reused for both v1 and v2 (overwritten between steps).
  let specPath: string;

  beforeAll(async () => {
    configureSdkForStaging();

    // 1. Create a fresh team via SDK (no CLI command for team create yet).
    const team = (await PublicTeamsService.createTeam({
      requestBody: { name: teamSlug },
    })) as { id?: string };
    if (!team.id) {
      throw new Error(`createTeam returned no id (response: ${JSON.stringify(team)})`);
    }
    teamId = team.id;

    // 2. Stage the v1 spec on disk for `spec0 push`.
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), `spec0-cli-lifecycle-${stamp}-`));
    specPath = join(dir, `${apiSlug}.yaml`);
    writeFileSync(specPath, MINIMAL_SPEC_V1, "utf-8");
  }, 30_000);

  afterAll(async () => {
    configureSdkForStaging();
    // Reverse-order cleanup: mock → api → team. Best-effort; swallow errors.
    if (mockServerId) {
      try {
        await PublicMocksService.deletePublicMock({ mockServerId });
      } catch (err) {
        console.warn(`[cleanup] deleteMock failed: ${(err as Error).message}`);
      }
    }
    if (apiId) {
      try {
        await PublicApisService.deleteTeamApi({ apiId });
      } catch (err) {
        console.warn(`[cleanup] deleteTeamApi failed: ${(err as Error).message}`);
      }
    }
    if (teamId) {
      try {
        await PublicTeamsService.deleteTeam({ teamId });
      } catch (err) {
        console.warn(`[cleanup] deleteTeam failed: ${(err as Error).message}`);
      }
    }
  }, 30_000);

  it("step 1 — spec0 push creates the team-scoped API", () => {
    // Pass an explicit per-run git-sha. CI auto-detects HEAD as the same SHA
    // for every step, which would trip the backend's SHA-idempotency check on
    // the v2 push. We give v1 and v2 distinct fake SHAs so both go through.
    const v1Sha = `${stamp.toString(16)}aa00000000000000000000000000000000`.slice(0, 40);
    const r = runCli(
      [
        "push",
        specPath,
        "--name",
        apiSlug,
        "--team",
        teamSlug,
        "--git-sha",
        v1Sha,
        "--skip-lint",
        "--format",
        "json",
      ],
      { env: stagingEnvAsRecord() },
    );

    if (r.status !== 0) {
      console.error(`[push v1] stdout:\n${r.stdout}\n[push v1] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as PushJsonOutput;
    expect(out.apiName).toBe(apiSlug);
    expect(out.created).toBe(true);
    expect(out.versionCreated).toBe(true);
    expect(typeof out.apiId).toBe("string");
    apiId = out.apiId;
  }, 60_000);

  it("step 2 — spec0 status reflects the new API", () => {
    const r = runCli(["status", "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[status] stdout:\n${r.stdout}\n[status] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as { apiCount?: number; teamCount?: number };
    expect(typeof out.apiCount).toBe("number");
    expect((out.apiCount ?? 0) >= 1).toBe(true);
  }, 30_000);

  it("step 3 — spec0 api list finds the new API", () => {
    const r = runCli(["api", "list", "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[api list] stdout:\n${r.stdout}\n[api list] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const parsed = JSON.parse(r.stdout) as ApiListJsonRow[] | { data?: ApiListJsonRow[] };
    const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
    const hit = rows.find((r) => r.apiName === apiSlug);
    expect(hit).toBeDefined();
    expect(hit?.teamName).toBe(teamSlug);
  }, 30_000);

  it("step 4 — spec0 mock create provisions a mock", () => {
    const r = runCli(["mock", "create", "--api", apiSlug, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });
    if (r.status !== 0) {
      console.error(`[mock create] stdout:\n${r.stdout}\n[mock create] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as MockCreateJsonOutput;
    expect(out.mockUrl).toContain("/mock/");
    expect(typeof out.created).toBe("boolean");
    // capture mockServerId for cleanup (parse from URL: /mock/<uuid>)
    const m = /\/mock\/([0-9a-f-]+)/i.exec(out.mockUrl);
    if (m) mockServerId = m[1];
  }, 30_000);

  it("step 5 — spec0 mock list sees the new mock", () => {
    const r = runCli(["mock", "list", "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[mock list] stdout:\n${r.stdout}\n[mock list] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const parsed = JSON.parse(r.stdout) as MockListJsonRow[] | { data?: MockListJsonRow[] };
    const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
    const hit = rows.find((r) => r.api === apiSlug);
    expect(hit).toBeDefined();
    expect(hit?.mockUrl).toContain("/mock/");
  }, 30_000);

  it("step 6 — spec0 mock show finds the mock by API slug", () => {
    const r = runCli(["mock", "show", apiSlug, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });
    if (r.status !== 0) {
      console.error(`[mock show] stdout:\n${r.stdout}\n[mock show] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as MockShowJsonOutput;
    expect(out.apiName).toBe(apiSlug);
    expect(out.mockUrl).toContain("/mock/");
  }, 30_000);

  it("step 7 — spec0 mock url emits a single absolute URL", () => {
    const r = runCli(["mock", "url", apiSlug], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[mock url] stdout:\n${r.stdout}\n[mock url] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const url = r.stdout.trim();
    expect(url.split("\n").length).toBe(1);
    expect(url.startsWith(stagingEnv.apiUrl)).toBe(true);
    expect(url).toContain("/mock/");
  }, 30_000);

  it("step 8 — spec0 push v2 publishes a second version", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(specPath, MINIMAL_SPEC_V2, "utf-8");

    // Distinct from step 1's git-sha so the backend doesn't short-circuit on
    // SHA idempotency.
    const v2Sha = `${stamp.toString(16)}bb00000000000000000000000000000000`.slice(0, 40);
    const r = runCli(
      [
        "push",
        specPath,
        "--name",
        apiSlug,
        "--team",
        teamSlug,
        "--version",
        "0.2.0",
        "--git-sha",
        v2Sha,
        "--skip-lint",
        "--format",
        "json",
      ],
      { env: stagingEnvAsRecord() },
    );
    if (r.status !== 0) {
      console.error(`[push v2] stdout:\n${r.stdout}\n[push v2] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as PushJsonOutput;
    expect(out.apiName).toBe(apiSlug);
    expect(out.created).toBe(false); // existing API, just a new version
    expect(out.versionCreated).toBe(true);
    expect(out.version).toBe("0.2.0");
  }, 60_000);

  it("step 9 — spec0 api changelog 0.1.0 → 0.2.0 returns a structured diff", () => {
    const r = runCli(
      ["api", "changelog", apiSlug, "--from", "0.1.0", "--to", "0.2.0", "--output", "json"],
      { env: stagingEnvAsRecord() },
    );
    if (r.status !== 0) {
      console.error(`[api changelog] stdout:\n${r.stdout}\n[api changelog] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as { fromTag: string; toTag: string; changes: unknown[] };
    expect(out.fromTag).toBe("0.1.0");
    expect(out.toTag).toBe("0.2.0");
    expect(Array.isArray(out.changes)).toBe(true);
  }, 30_000);

  it("step 10 — spec0 api show returns details for the API", () => {
    const r = runCli(["api", "show", apiSlug, "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[api show] stdout:\n${r.stdout}\n[api show] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as { apiId?: string; apiName?: string };
    expect(out.apiId).toBe(apiId);
  }, 30_000);

  it("step 11 — spec0 mock delete removes the mock (CLI-driven teardown)", () => {
    const r = runCli(["mock", "delete", apiSlug, "--yes"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[mock delete] stdout:\n${r.stdout}\n[mock delete] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);
    // CLI handled teardown — clear so afterAll's SDK safety-net doesn't double-delete.
    mockServerId = undefined;

    const list = runCli(["mock", "list", "--output", "json"], { env: stagingEnvAsRecord() });
    expect(list.status).toBe(0);
    const parsed = JSON.parse(list.stdout) as MockListJsonRow[] | { data?: MockListJsonRow[] };
    const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
    expect(rows.find((row) => row.api === apiSlug)).toBeUndefined();
  }, 30_000);

  it("step 12 — spec0 api delete removes the API (CLI-driven teardown)", () => {
    const r = runCli(["api", "delete", apiSlug, "--yes"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) {
      console.error(`[api delete] stdout:\n${r.stdout}\n[api delete] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);
    apiId = undefined;

    const list = runCli(["api", "list", "--output", "json"], { env: stagingEnvAsRecord() });
    expect(list.status).toBe(0);
    const parsed = JSON.parse(list.stdout) as ApiListJsonRow[] | { data?: ApiListJsonRow[] };
    const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
    expect(rows.find((row) => row.apiName === apiSlug)).toBeUndefined();
  }, 30_000);
});
