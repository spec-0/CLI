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
 * Defaults below match local dev (Next :3000, backend :8080 at the host root). Override both for
 * staging/production. `SPEC0_API_URL` should align with `NEXT_PUBLIC_API_BASE_URL` in
 * the web UI, not the Next.js site origin alone.
 *
 * Legacy: `PLATFORM_APP_URL` / `PLATFORM_API_URL` are still accepted as fallbacks.
 */

/** Next.js / browser app — CLI auth (`/cli-auth`) and push output links. */
export const DEFAULT_PLATFORM_APP_URL = "https://app.spec0.io";

/**
 * Backend API base. The platform serves at the host root, so this is a bare host
 * with no path suffix; the SDK and raw call sites append their own service paths.
 */
export const DEFAULT_PLATFORM_API_URL = "https://api.spec0.io";

/**
 * Canonical MCP (Model Context Protocol) server endpoint. This is the single
 * Streamable HTTP endpoint that MCP clients (Cursor, Claude) connect to over
 * HTTP POST. A bearer token is optional: anonymous access exposes the public
 * docs tools, and an authenticated token unlocks the org-scoped tools. It is a
 * different surface from the REST API base, so it has its own default and its
 * own override env var.
 */
export const DEFAULT_PLATFORM_MCP_URL = "https://api.spec0.io/mcp";

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

/**
 * Canonical MCP Streamable HTTP endpoint clients connect to. Override with
 * `SPEC0_MCP_URL` (legacy `PLATFORM_MCP_URL` accepted as a fallback) for
 * staging/self-hosted.
 */
export function resolvedPlatformMcpUrl(): string {
  const raw = (process.env.SPEC0_MCP_URL ?? process.env.PLATFORM_MCP_URL)?.trim();
  return normalizeOrigin(raw || DEFAULT_PLATFORM_MCP_URL);
}

/**
 * MCP base used as the root for sibling MCP paths such as the health probe
 * behind `spec0 mcp test`. With the single Streamable HTTP endpoint the URL is
 * already the base, so for back-compat we only trim a legacy trailing `/sse`
 * (older overrides may still carry it) and otherwise return the endpoint as-is.
 * Derived from the same default/override as {@link resolvedPlatformMcpUrl} so
 * the two never drift apart — e.g. `…/mcp` → `…/mcp/health`.
 */
export function resolvedPlatformMcpBaseUrl(): string {
  return resolvedPlatformMcpUrl().replace(/\/sse$/, "");
}
