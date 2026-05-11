/**
 * Two origins — do not conflate them:
 *
 * - **`SPEC0_APP_URL`** — Web app only: opening the browser for `spec0 auth login`
 *   (`/cli-auth`). Also used when printing dashboard links in `spec0 push` output (`specUrl`);
 *   that is not an API request.
 * - **`SPEC0_API_URL`** — Spring backend base for **all** programmatic HTTP (push, pull, mock,
 *   lint, search, registry, …). Stored on login as `org.apiUrl` and used by
 *   `createOrgApiClient` / `createApiClient`.
 *
 * Defaults below match local dev (Next :3000, Spring :8080 + context path). Override both for
 * staging/production. `SPEC0_API_URL` should align with `NEXT_PUBLIC_API_BASE_URL` in
 * api-management-ui, not the Next.js site origin alone.
 *
 * Legacy: `PLATFORM_APP_URL` / `PLATFORM_API_URL` are still accepted as fallbacks.
 */

/** Next.js / browser app — CLI auth (`/cli-auth`) and push output links. */
export const DEFAULT_PLATFORM_APP_URL = "https://app.spec0.io";

/**
 * Spring Boot API base (include servlet context path if your deploy uses one).
 */
export const DEFAULT_PLATFORM_API_URL = "https://api.spec0.io/api-management";

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** Web app origin for auth + UI links — never used as the REST base. */
export function resolvedPlatformAppUrl(): string {
  const raw = (process.env.SPEC0_APP_URL ?? process.env.PLATFORM_APP_URL)?.trim();
  return normalizeOrigin(raw || DEFAULT_PLATFORM_APP_URL);
}

/** Backend base for all CLI REST calls — never derived from the app URL. */
export function resolvedPlatformApiUrl(): string {
  const raw = (process.env.SPEC0_API_URL ?? process.env.PLATFORM_API_URL)?.trim();
  return normalizeOrigin(raw || DEFAULT_PLATFORM_API_URL);
}
