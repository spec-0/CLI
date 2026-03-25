/**
 * Resolve org API URL, token, and org id for CLI commands.
 * Priority: env PLATFORM_* > --org flag > default org from config.
 *
 * **`PLATFORM_API_URL`** (when set) overrides the API base stored at login for every command,
 * so you can fix a bad `apiUrl` or point at another backend without editing ~/.winspect/config.json.
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
  const token = process.env.PLATFORM_API_TOKEN;
  const envOrg = process.env.PLATFORM_ORG_ID;
  const envApi = process.env.PLATFORM_API_URL;

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
  const apiUrl = (envApi?.trim() ? envApi.trim().replace(/\/$/, "") : storedApi);
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
      "Not authenticated. Run 'winspect auth login' or set PLATFORM_API_TOKEN and PLATFORM_ORG_ID."
    );
  }
  return ctx;
}
