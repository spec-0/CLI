/**
 * Staging integration test: `spec0 publish` end-to-end via the SDK.
 *
 * Skipped automatically when staging env vars (`SPEC0_API_URL`, `SPEC0_ORG_ID`,
 * `SPEC0_TOKEN`) are missing — see `staging-env.ts`. The default `npm test`
 * also excludes `test/integration/` (jest's `testPathIgnorePatterns`); this
 * test runs only via `npm run test:integration` or the
 * `staging-integration.yml` workflow.
 *
 * What this test asserts:
 *   1. The CLI builds and resolves staging credentials.
 *   2. `publish --bump minor --visibility draft --format json` round-trips
 *      successfully against the live `/api/v1/public/apis` endpoint.
 *   3. The JSON envelope shape matches what downstream tooling (CI annotations,
 *      docs scripts) consumes: `created`, `versionCreated`, `version`,
 *      `publicApiId`.
 *
 * Cleanup: the test soft-deletes the API it created via the SDK
 * `PublicApisService.deletePublicApi`. Visibility=DRAFT keeps it out of the
 * public registry even if cleanup fails (e.g. transient network blip), so a
 * leaked test record can't pollute customer-visible search results.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPI, PublicApisService } from "@spec0/sdk-public-platform";
import { runCli } from "./runCli";
import { stagingEnv, stagingEnvAsRecord, STAGING_ENV_AVAILABLE } from "./staging-env";

/** Tiny valid OpenAPI 3.0 doc — passes Spectral cleanly; we still pass --skip-lint
 *  belt-and-braces in case the staging Spectral ruleset is ever stricter than the
 *  bundled one. */
const MINIMAL_SPEC = `openapi: 3.0.3
info:
  title: CLI Staging Integration
  version: 0.0.1
  description: Throw-away spec published by the @spec0/cli staging integration test.
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

interface PublishJsonOutput {
  publicApiId: string;
  apiSlug: string;
  orgSlug?: string;
  version: string;
  visibility: string;
  created: boolean;
  versionCreated: boolean;
  publicUrl: string;
}

/** Deletes a public API directly via the SDK. Best-effort — logs errors but
 *  doesn't throw, since `afterAll` cleanup shouldn't mask test failures. */
async function cleanupPublicApi(publicApiId: string): Promise<void> {
  if (!STAGING_ENV_AVAILABLE) return;
  // The SDK uses a global `OpenAPI` config singleton. Configure it the same way
  // the CLI does in `configureSdkAuth()` — the staging API URL needs the
  // `/api-management` context path appended.
  OpenAPI.BASE = `${stagingEnv.apiUrl}/api-management`;
  OpenAPI.TOKEN = stagingEnv.token;
  OpenAPI.HEADERS = { "X-Org-Id": stagingEnv.orgId };
  try {
    await PublicApisService.deletePublicApi({ publicApiId });
  } catch (err) {
     
    console.warn(
      `[cleanup] failed to delete public API ${publicApiId}: ${(err as Error).message ?? err}`,
    );
  }
}

const describeFn = STAGING_ENV_AVAILABLE ? describe : describe.skip;

describeFn("staging integration: spec0 publish", () => {
  let tmpDir: string;
  let specPath: string;
  let publicApiId: string | null = null;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "spec0-cli-int-"));
    specPath = join(tmpDir, "spec.yaml");
    writeFileSync(specPath, MINIMAL_SPEC, "utf8");
  });

  afterAll(async () => {
    if (publicApiId) {
      await cleanupPublicApi(publicApiId);
    }
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("publishes a new public API end-to-end via the SDK", () => {
    // Date.now() suffix keeps slugs unique across re-runs; ms precision is
    // enough — the workflow is manual-trigger and not parallelized.
    const slug = `cli-staging-${Date.now()}`;
    const r = runCli(
      [
        "publish",
        specPath,
        "--name",
        slug,
        "--bump",
        "minor",
        "--visibility",
        "draft",
        "--skip-lint",
        "--format",
        "json",
      ],
      { env: stagingEnvAsRecord() },
    );

    // On failure, surface stderr so the workflow log explains why.
    if (r.status !== 0) {
       
      console.error(`[publish] stdout:\n${r.stdout}\n[publish] stderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);

    const out = JSON.parse(r.stdout) as PublishJsonOutput;
    expect(out.created).toBe(true);
    expect(out.versionCreated).toBe(true);
    expect(out.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(out.apiSlug).toBe(slug);
    expect(typeof out.publicApiId).toBe("string");
    expect(out.publicApiId.length).toBeGreaterThan(0);

    // Stash for cleanup.
    publicApiId = out.publicApiId;
  }, 30_000);
});
