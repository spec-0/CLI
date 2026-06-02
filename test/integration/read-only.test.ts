/**
 * Staging integration: read-only health + error-contract smoke.
 *
 * Pure CLI read commands plus the HTTP-status → stable-exit-code contract,
 * exercised against the live backend. Creates nothing, and every check here is
 * token-agnostic — it passes on either a legacy org key or a SAT — so it's the
 * lightweight, always-runnable health check alongside the write journey in
 * `lifecycle.test.ts`. (Team-scoped reads like `api list` need a team-bound
 * principal, so they're covered in the SAT-based lifecycle test, not here.)
 *
 * Skipped automatically when staging env vars are missing (see staging-env.ts).
 * Runs via `npm run test:integration` / the `staging-integration.yml` workflow.
 */
import { runCli } from "./runCli";
import { stagingEnvAsRecord, STAGING_ENV_AVAILABLE } from "./staging-env";

const describeFn = STAGING_ENV_AVAILABLE ? describe : describe.skip;

// A well-formed UUID that won't exist — exercises the 404 → NOT_FOUND path.
const ABSENT_UUID = "00000000-0000-0000-0000-000000000000";

describeFn("staging integration: read-only health + error contract", () => {
  it("whoami resolves the active org context", () => {
    // runCli sets SPEC0_MODE=agent, so output defaults to JSON.
    const r = runCli(["whoami"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) console.error(`[whoami] stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    expect(r.status).toBe(0);
  }, 30_000);

  it("doctor reports healthy auth + config", () => {
    const r = runCli(["doctor", "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) console.error(`[doctor] stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    expect(r.status).toBe(0);
  }, 30_000);

  it("status returns an org overview with counts", () => {
    const r = runCli(["status", "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) console.error(`[status] stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { apiCount?: number };
    expect(typeof out.apiCount).toBe("number");
  }, 30_000);

  it("team list returns the org's teams", () => {
    const r = runCli(["team", "list", "--output", "json"], { env: stagingEnvAsRecord() });
    if (r.status !== 0) console.error(`[team list] stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    expect(r.status).toBe(0);
  }, 30_000);

  // ── Error contract: HTTP status maps to the documented exit code ──

  it("api show <absent uuid> exits NOT_FOUND (5)", () => {
    const r = runCli(["api", "show", ABSENT_UUID, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });
    expect(r.status).toBe(5);
  }, 30_000);

  it("mock show <absent api> exits NOT_FOUND (5)", () => {
    const r = runCli(["mock", "show", `no-such-api-${Date.now()}`, "--output", "json"], {
      env: stagingEnvAsRecord(),
    });
    expect(r.status).toBe(5);
  }, 30_000);
});
