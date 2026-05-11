/**
 * Staging-environment env-var loader for integration tests.
 *
 * Reads the three values an integration run needs from `process.env`:
 *   - `SPEC0_API_URL`  — platform host root (e.g. `https://staging.spec0.io`)
 *   - `SPEC0_ORG_ID`   — UUID of the staging org used by the test SAT
 *   - `SPEC0_TOKEN`    — Service Access Token (SAT). The workflow exports this
 *     name (mapped from the `SPEC0_SAT_PUBLIC` repo secret) because it's also
 *     the var name the CLI itself reads via `requireOrgContext()`.
 *
 * If any are missing, `STAGING_ENV_AVAILABLE` is `false`, and tests must
 * `describe.skip` themselves so `npm test` stays green for contributors who
 * don't have staging access. The `.env`-style fallbacks for legacy var names
 * (`PLATFORM_*`) match `src/lib/auth-context.ts`.
 */
const apiUrl = process.env.SPEC0_API_URL ?? process.env.PLATFORM_API_URL;
const orgId = process.env.SPEC0_ORG_ID ?? process.env.PLATFORM_ORG_ID;
const token = process.env.SPEC0_TOKEN ?? process.env.PLATFORM_API_TOKEN;

export const STAGING_ENV_AVAILABLE: boolean = Boolean(
  apiUrl && apiUrl.trim() && orgId && orgId.trim() && token && token.trim(),
);

export interface StagingEnv {
  apiUrl: string;
  orgId: string;
  token: string;
}

/**
 * Throws if `STAGING_ENV_AVAILABLE` is false. Tests should always gate their
 * `describe` block on `STAGING_ENV_AVAILABLE` *first* — this getter exists
 * so test code can use the values without `!` non-null assertions.
 */
export const stagingEnv: StagingEnv = STAGING_ENV_AVAILABLE
  ? { apiUrl: apiUrl as string, orgId: orgId as string, token: token as string }
  : ({} as StagingEnv);

/**
 * Convenience: shape the staging env as the `Record<string, string>` that
 * `runCli({ env })` expects. The CLI reads `SPEC0_TOKEN`, `SPEC0_ORG_ID`,
 * `SPEC0_API_URL` directly from `process.env`; we just propagate them
 * unchanged.
 */
export function stagingEnvAsRecord(env: StagingEnv = stagingEnv): NodeJS.ProcessEnv {
  return {
    SPEC0_API_URL: env.apiUrl,
    SPEC0_ORG_ID: env.orgId,
    SPEC0_TOKEN: env.token,
  };
}
