/**
 * Staging integration test: `spec0 mock list` end-to-end via the SDK.
 *
 * Skipped automatically when staging env vars (`SPEC0_API_URL`, `SPEC0_ORG_ID`,
 * `SPEC0_TOKEN`) are missing — see `staging-env.ts`. The default `npm test`
 * also excludes `test/integration/` (jest's `testPathIgnorePatterns`); this
 * test runs only via `npm run test:integration` or the
 * `staging-integration.yml` workflow.
 *
 * Scope today: only `mock list` is exercised end-to-end. The fixture-dependent
 * tests (`mock create`, `mock show`, `mock url`) need a freshly-published
 * team-scoped API in `beforeAll`, which currently has no clean V1 surface to
 * provision and tear down (no team CRUD, no team-API delete, no mock delete).
 * The full create→test→cleanup lifecycle is tracked at
 * https://github.com/spec-0/spec0-platform/issues/86 — once those endpoints
 * land + the SDK auto-republishes, this file gets refactored to drive the full
 * lifecycle and the three `it.skip(...)` calls below become `it(...)`.
 */
import { runCli } from "./runCli";
import { stagingEnv, stagingEnvAsRecord, STAGING_ENV_AVAILABLE } from "./staging-env";

interface MockListJsonRow {
  api: string;
  name: string;
  mockUrl: string;
}

const describeFn = STAGING_ENV_AVAILABLE ? describe : describe.skip;

describeFn("staging integration: spec0 mock", () => {
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

  // ── Fixture-dependent tests: skipped until V1 lifecycle endpoints land ─────
  // Tracking: https://github.com/spec-0/spec0-platform/issues/86
  // Until POST /teams + DELETE /apis/team/{id} + DELETE /mocks/{id} exist, we
  // can't provision a fresh fixture in `beforeAll` without leaking rows in
  // staging. Keep these as `it.skip` (not deleted) so the structure is obvious
  // when we re-enable them.

  it.skip("mock create — provisions a mock for the fixture API (needs V1 lifecycle endpoints — spec0-platform#86)", () => {
    // beforeAll lifecycle (once endpoints land):
    //   1. createTeam → teamId
    //   2. publishTeamApi(team=teamSlug, name=apiSlug, openapiSpec=MINIMAL_SPEC)
    //   3. test body below
    // afterAll: deleteMock → deleteApi → deleteTeam (best-effort).
    const apiSlug = `cli-mock-staging-${Date.now()}`;
    const r = runCli(["mock", "create", "--api", apiSlug, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });
    expect(r.status).toBe(0);
  }, 30_000);

  it.skip("mock show — finds the freshly-created mock by API slug (needs V1 lifecycle endpoints — spec0-platform#86)", () => {
    const apiSlug = `cli-mock-staging-${Date.now()}`;
    const r = runCli(["mock", "show", apiSlug, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });
    expect(r.status).toBe(0);
  }, 30_000);

  it.skip("mock url — emits a single-line URL for the freshly-created mock (needs V1 lifecycle endpoints — spec0-platform#86)", () => {
    const apiSlug = `cli-mock-staging-${Date.now()}`;
    const r = runCli(["mock", "url", apiSlug], { env: stagingEnvAsRecord() });
    expect(r.status).toBe(0);
    const url = r.stdout.trim();
    expect(url.startsWith(stagingEnv.apiUrl)).toBe(true);
  }, 30_000);
});
