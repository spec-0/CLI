/**
 * Staging integration test: `spec0 mock list|create|show|url` end-to-end via the SDK.
 *
 * Skipped automatically when staging env vars (`SPEC0_API_URL`, `SPEC0_ORG_ID`,
 * `SPEC0_TOKEN`) are missing — see `staging-env.ts`. The default `npm test`
 * also excludes `test/integration/` (jest's `testPathIgnorePatterns`); this
 * test runs only via `npm run test:integration` or the
 * `staging-integration.yml` workflow.
 *
 * What this test asserts:
 *   1. `mock list` round-trips against the live `/api/v1/public/mocks` endpoint
 *      with exit 0 and a parseable JSON envelope.
 *   2. `mock create --api <slug>` provisions a mock for a freshly-published
 *      team-scoped API (set up in `beforeAll` via `publishTeamApi`) and
 *      returns the URL + one-time key.
 *   3. `mock show <api>` and `mock url <api>` both find the mock created in (2)
 *      via the same `listPublicMocks` wire path.
 *
 * Why team-scoped publish (not public publish):
 *   The mock-create endpoint resolves an `ApiEntity` (the team-scoped registry
 *   that `spec0 push` writes to) — NOT a `PublicApiEntity` (what `spec0 publish`
 *   writes to). They're separate tables. The fixture must use `publishTeamApi`
 *   so mock-create's lookup actually finds the API.
 *
 * Cleanup:
 *   No-op. Neither team-scoped APIs nor mock servers have a public V1 delete
 *   endpoint today. Each successful run leaks one ApiEntity row + one
 *   mock-server row. Pre-launch this is acceptable; tracked as a follow-up to
 *   add the missing delete endpoints. Per-run unique slugs (`Date.now()`-
 *   suffixed) keep collisions impossible.
 */
import { OpenAPI, PublicApisService } from "@spec0/sdk-public-platform";
import { runCli } from "./runCli";
import { stagingEnv, stagingEnvAsRecord, STAGING_ENV_AVAILABLE } from "./staging-env";

/** Inline OpenAPI 3.0 doc — mirrors `publish.test.ts`. Spectral-clean and
 *  small enough that the publish round-trip is fast even on slow staging. */
const MINIMAL_SPEC = `openapi: 3.0.3
info:
  title: CLI Staging Integration (mocks)
  version: 0.0.1
  description: Throw-away spec used by the @spec0/cli mock-command staging integration test.
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

/** Sets up the SDK's global config the same way `configureSdkAuth` does in the
 *  CLI. Used by the team-api publish helper in `beforeAll`. */
function configureSdkForStaging(): void {
  OpenAPI.BASE = `${stagingEnv.apiUrl}/api-management`;
  OpenAPI.TOKEN = stagingEnv.token;
  OpenAPI.HEADERS = { "X-Org-Id": stagingEnv.orgId };
}

const describeFn = STAGING_ENV_AVAILABLE ? describe : describe.skip;

describeFn("staging integration: spec0 mock", () => {
  // Per-test-run unique slug so re-runs don't collide. Date.now() ms precision
  // is sufficient — the workflow is manual-trigger, not parallel.
  const apiSlug = `cli-mock-staging-${Date.now()}`;

  beforeAll(async () => {
    // Mock-create's lookup hits ApiEntity (the team-scoped registry that
    // `spec0 push` writes to) — NOT PublicApiEntity (the public registry that
    // `spec0 publish` writes to). They're separate tables. So we publish via
    // `publishTeamApi` here (Phase 2's V1 wrapper around the legacy
    // /cli/v1/publish flow) rather than `publishPublicApi`.
    //
    // Cleanup: there's no public V1 endpoint to delete a team-scoped API yet
    // (the platform's `softDelete` flow is for PublicApiEntity only). Test
    // runs leak one ApiEntity row + one mock-server row per execution. Pre-
    // launch this is acceptable; tracked as a follow-up to add a delete-team-
    // api endpoint or extend the existing softDelete.
    configureSdkForStaging();
    try {
      await PublicApisService.publishTeamApi({
        requestBody: {
          name: apiSlug,
          version: "0.1.0",
          openapiSpec: MINIMAL_SPEC,
        },
      });
    } catch (err) {
      // Surface the response body so backend errors aren't swallowed as a
      // generic "ApiError: Internal Server Error" — drives diagnosis on
      // failures.
      const e = err as { status?: number; statusText?: string; body?: unknown };
      console.error(
        `[publishTeamApi] failed status=${e.status} statusText=${e.statusText} body=${JSON.stringify(e.body)}`,
      );
      throw err;
    }
    // publishTeamApi's response shape doesn't include a stable id we can use
    // for cleanup; we rely on `apiSlug` for downstream lookups instead.
  }, 30_000);

  afterAll(async () => {
    // No-op. See beforeAll comment — team-api delete isn't exposed on V1 yet.
    // Re-runs use unique `Date.now()`-suffixed slugs so they don't collide.
  }, 30_000);

  it("mock list — round-trips and emits valid JSON", () => {
    const r = runCli(["mock", "list", "--output", "json"], { env: stagingEnvAsRecord() });

    if (r.status !== 0) {
      console.error(`[mock list] stdout:\n${r.stdout}\n[mock list] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    // `emit` for an array currently wraps via the same path as object output;
    // be permissive about whether the agent has wrapped it in a `data` envelope
    // or emitted the bare array. The shape we actually consume is "array of
    // rows with at least an `api` and `mockUrl` key".
    const parsed = JSON.parse(r.stdout) as MockListJsonRow[] | { data?: MockListJsonRow[] };
    const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(typeof row.api).toBe("string");
      expect(typeof row.mockUrl).toBe("string");
    }
  }, 30_000);

  it("mock create — provisions a mock for the fixture API", () => {
    const r = runCli(["mock", "create", "--api", apiSlug, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });

    if (r.status !== 0) {
      console.error(`[mock create] stdout:\n${r.stdout}\n[mock create] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as MockCreateJsonOutput;
    // Mock URL must be absolute (apiUrl + mockBaseUrl) and contain `/mock/`.
    expect(typeof out.mockUrl).toBe("string");
    expect(out.mockUrl.length).toBeGreaterThan(0);
    expect(out.mockUrl).toContain("/mock/");
    // `created` is true on first provision; if a previous run leaked the mock
    // (cf. cleanup TODO above) the endpoint is idempotent and returns the
    // existing one with `created: false`. Both are valid here.
    expect(typeof out.created).toBe("boolean");
  }, 30_000);

  it("mock show — finds the freshly-created mock by API slug", () => {
    const r = runCli(["mock", "show", apiSlug, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });

    if (r.status !== 0) {
      console.error(`[mock show] stdout:\n${r.stdout}\n[mock show] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as MockShowJsonOutput;
    expect(out.apiName).toBe(apiSlug);
    expect(typeof out.mockUrl).toBe("string");
    expect(out.mockUrl).toContain("/mock/");
    expect(typeof out.mockServerId).toBe("string");
  }, 30_000);

  it("mock url — emits a single-line URL for the freshly-created mock", () => {
    const r = runCli(["mock", "url", apiSlug], { env: stagingEnvAsRecord() });

    if (r.status !== 0) {
      console.error(`[mock url] stdout:\n${r.stdout}\n[mock url] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    // `mock url` writes exactly one line ending in '\n'. Trim and assert shape.
    const url = r.stdout.trim();
    expect(url.length).toBeGreaterThan(0);
    expect(url.split("\n").length).toBe(1);
    expect(url).toContain("/mock/");
    expect(url.startsWith(stagingEnv.apiUrl)).toBe(true);
  }, 30_000);
});
