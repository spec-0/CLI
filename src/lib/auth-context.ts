/**
 * Resolve org API URL, token, and org id for CLI commands.
 * Priority: env SPEC0_* > --org flag > default org from config.
 *
 * **`SPEC0_API_URL`** (when set) overrides the API base stored at login for every command,
 * so you can fix a bad `apiUrl` or point at another backend without editing ~/.spec0/config.json.
 *
 * Legacy: `PLATFORM_API_TOKEN` / `PLATFORM_ORG_ID` / `PLATFORM_API_URL` are still accepted.
 */

import { getDefaultOrgId, getOrgConfig } from "./config.js";
import { resolvedPlatformApiUrl } from "./platform-defaults.js";

export interface ResolvedOrgContext {
  orgId: string;
  apiKey: string;
  apiUrl: string;
  orgName?: string;
}

export function resolveOrgContext(optionsOrgId?: string): ResolvedOrgContext | null {
  const token = process.env.SPEC0_TOKEN ?? process.env.PLATFORM_API_TOKEN;
  const envOrg = process.env.SPEC0_ORG_ID ?? process.env.PLATFORM_ORG_ID;
  const envApi = process.env.SPEC0_API_URL ?? process.env.PLATFORM_API_URL;

  if (token && envOrg) {
    const fromConfig = getOrgConfig(envOrg);
    const apiUrl = (envApi ?? fromConfig?.apiUrl ?? resolvedPlatformApiUrl()).replace(/\/$/, "");
    return {
      orgId: envOrg,
      apiKey: token,
      apiUrl,
      orgName: fromConfig?.name,
    };
  }

  const orgId = optionsOrgId ?? getDefaultOrgId();
  if (!orgId) return null;
  const org = getOrgConfig(orgId);
  if (!org) return null;
  const storedApi = org.apiUrl?.trim()
    ? org.apiUrl.replace(/\/$/, "")
    : resolvedPlatformApiUrl();
  const apiUrl = envApi?.trim() ? envApi.trim().replace(/\/$/, "") : storedApi;
  return {
    orgId,
    apiKey: org.apiKey,
    apiUrl,
    orgName: org.name,
  };
}

export function requireOrgContext(optionsOrgId?: string): ResolvedOrgContext {
  const ctx = resolveOrgContext(optionsOrgId);
  if (!ctx) {
    throw new Error(
      "Not authenticated. Run 'spec0 auth login' to log in, or set SPEC0_TOKEN and SPEC0_ORG_ID environment variables."
    );
  }
  return ctx;
}
