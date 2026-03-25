/**
 * Two origins — do not conflate them:
 *
 * - **`PLATFORM_APP_URL`** — Web app only: opening the browser for `winspect auth login`
 *   (`/cli-auth`). Also used when printing **dashboard links** in `winspect register` output
 *   (`specUrl`); that is not an API request.
 * - **`PLATFORM_API_URL`** — Spring backend base for **all** programmatic HTTP (register,
 *   pull, mock, lint, search, registry, …). Stored on login as `org.apiUrl` and used by
 *   `createOrgApiClient` / `createApiClient`.
 *
 * Defaults below match local dev (Next :3000, Spring :8080 + context path). Override both for
 * staging/production. `PLATFORM_API_URL` should align with `NEXT_PUBLIC_API_BASE_URL` in
 * api-management-ui, not the Next.js site origin alone.
 */

/** Next.js / browser app — CLI auth (`/cli-auth`) and register output links. */
export const DEFAULT_PLATFORM_APP_URL = "http://localhost:3000";

/**
 * Spring Boot API base (include servlet context path if your deploy uses one).
 * Local default matches api-management-ui `NEXT_PUBLIC_API_BASE_URL`.
 */
export const DEFAULT_PLATFORM_API_URL = "http://localhost:8080/api-management";

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** Web app origin for auth + UI links — never used as the REST base. */
export function resolvedPlatformAppUrl(): string {
  const raw = process.env.PLATFORM_APP_URL?.trim();
  return normalizeOrigin(raw || DEFAULT_PLATFORM_APP_URL);
}

/** Backend base for all CLI REST calls: `PLATFORM_API_URL` or default (never derived from the app URL). */
export function resolvedPlatformApiUrl(): string {
  const raw = process.env.PLATFORM_API_URL?.trim();
  return normalizeOrigin(raw || DEFAULT_PLATFORM_API_URL);
}
