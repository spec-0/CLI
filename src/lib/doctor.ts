/**
 * Diagnostic helpers — used by `spec0 doctor` and (one day) by error
 * messages that want to attach a "here's what's set right now" pointer.
 *
 * The goal: make every "auth missing" or "wrong URL" failure into something
 * the user can act on in 30 seconds, by surfacing where each setting came
 * from (env var name, config file path, or default).
 */

import { getConfigPath, getDefaultOrgId, getOrgConfig } from "./config.js";
import {
  DEFAULT_PLATFORM_API_URL,
  DEFAULT_PLATFORM_APP_URL,
  resolvedPlatformApiUrl,
  resolvedPlatformAppUrl,
} from "./platform-defaults.js";

export type SettingSource =
  | { kind: "env"; var: string }
  | { kind: "config"; path: string }
  | { kind: "default" }
  | { kind: "missing" };

export interface SettingReport {
  name: string;
  /** Display value; secrets are redacted. */
  value: string;
  source: SettingSource;
}

export interface DoctorReport {
  settings: SettingReport[];
  /** Aggregate status — "ok" only when every required setting is non-missing. */
  ok: boolean;
  /** Path to the local config file (whether or not it exists). */
  configPath: string;
}

/**
 * Build a structured diagnostic of the runtime config the CLI sees right now.
 * Pure — no network calls. Good for inclusion in `--verbose` output too.
 */
export function buildDoctorReport(): DoctorReport {
  const settings: SettingReport[] = [];

  // Token: env wins; otherwise from default org's config; otherwise missing.
  const envToken = process.env.SPEC0_TOKEN ?? process.env.PLATFORM_API_TOKEN;
  const defaultOrgId = process.env.SPEC0_ORG_ID ?? process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
  const cfg = defaultOrgId ? getOrgConfig(defaultOrgId) : undefined;

  settings.push({
    name: "token",
    value: redactToken(envToken ?? cfg?.apiKey),
    source: envToken
      ? { kind: "env", var: process.env.SPEC0_TOKEN ? "SPEC0_TOKEN" : "PLATFORM_API_TOKEN" }
      : cfg?.apiKey
        ? { kind: "config", path: getConfigPath() }
        : { kind: "missing" },
  });

  settings.push({
    name: "orgId",
    value: defaultOrgId ?? "(missing)",
    source: process.env.SPEC0_ORG_ID
      ? { kind: "env", var: "SPEC0_ORG_ID" }
      : process.env.PLATFORM_ORG_ID
        ? { kind: "env", var: "PLATFORM_ORG_ID" }
        : defaultOrgId
          ? { kind: "config", path: getConfigPath() }
          : { kind: "missing" },
  });

  // API URL: env override wins; otherwise config; otherwise default.
  const envApiUrl = process.env.SPEC0_API_URL ?? process.env.PLATFORM_API_URL;
  const apiUrl = resolvedPlatformApiUrl();
  settings.push({
    name: "apiUrl",
    value: apiUrl,
    source: envApiUrl
      ? { kind: "env", var: process.env.SPEC0_API_URL ? "SPEC0_API_URL" : "PLATFORM_API_URL" }
      : cfg?.apiUrl
        ? { kind: "config", path: getConfigPath() }
        : apiUrl === DEFAULT_PLATFORM_API_URL
          ? { kind: "default" }
          : { kind: "config", path: getConfigPath() },
  });

  // App URL — used for browser auth + dashboard links only.
  const envAppUrl = process.env.SPEC0_APP_URL ?? process.env.PLATFORM_APP_URL;
  const appUrl = resolvedPlatformAppUrl();
  settings.push({
    name: "appUrl",
    value: appUrl,
    source: envAppUrl
      ? { kind: "env", var: process.env.SPEC0_APP_URL ? "SPEC0_APP_URL" : "PLATFORM_APP_URL" }
      : appUrl === DEFAULT_PLATFORM_APP_URL
        ? { kind: "default" }
        : { kind: "config", path: getConfigPath() },
  });

  // Mode: "agent" when SPEC0_MODE=agent, "human" otherwise. Surfaced so agents
  // can confirm the mode they think they're in is actually active.
  const mode = (process.env.SPEC0_MODE ?? "").toLowerCase() === "agent" ? "agent" : "human";
  settings.push({
    name: "mode",
    value: mode,
    source: process.env.SPEC0_MODE ? { kind: "env", var: "SPEC0_MODE" } : { kind: "default" },
  });

  // OK when token + orgId are present — those are the only two strictly required.
  const ok = settings.every((s) => {
    if (s.name === "token" || s.name === "orgId") return s.source.kind !== "missing";
    return true;
  });

  return {
    settings,
    ok,
    configPath: getConfigPath(),
  };
}

function redactToken(value: string | undefined): string {
  if (!value) return "(missing)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Stringify a setting source for human display. */
export function describeSource(source: SettingSource): string {
  switch (source.kind) {
    case "env":
      return `env: ${source.var}`;
    case "config":
      return `config: ${source.path}`;
    case "default":
      return "default";
    case "missing":
      return "(not set)";
  }
}
