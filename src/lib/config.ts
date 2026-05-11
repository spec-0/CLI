/**
 * ~/.spec0/config.json management
 * XDG-compliant config via conf package
 */

import Conf from "conf";

export interface OrgConfig {
  apiKey: string;
  name: string;
  apiUrl: string;
  keyName?: string;
}

export interface Spec0Config {
  version: number;
  defaultOrg?: string;
  telemetry?: boolean;
  orgs: Record<string, OrgConfig>;
}

// Schema kept for documentation; not currently passed to Conf (defaults below
// are sufficient). Renamed `_schema` to satisfy lint while retaining intent.
const _schema = {
  version: { type: "number", default: 1 },
  defaultOrg: { type: ["string", "null"], default: null },
  telemetry: { type: "boolean", default: true },
  orgs: { type: "object", default: {} },
} as const;

const store = new Conf<Spec0Config>({
  projectName: "spec0",
  defaults: {
    version: 1,
    defaultOrg: undefined,
    telemetry: true,
    orgs: {},
  },
});

export function getConfig(): Spec0Config {
  return {
    version: store.get("version", 1),
    defaultOrg: store.get("defaultOrg"),
    telemetry: store.get("telemetry", true),
    orgs: store.get("orgs", {}),
  };
}

export function getDefaultOrgId(): string | null {
  return store.get("defaultOrg") ?? null;
}

export function getOrgConfig(orgId: string): OrgConfig | undefined {
  return store.get(`orgs.${orgId}`);
}

export function setOrgConfig(orgId: string, config: OrgConfig): void {
  store.set(`orgs.${orgId}`, config);
}

export function setDefaultOrg(orgId: string): void {
  store.set("defaultOrg", orgId);
}

export function clearConfig(): void {
  store.clear();
}

export function getConfigPath(): string {
  return store.path;
}
