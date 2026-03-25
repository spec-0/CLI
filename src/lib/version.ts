/**
 * CLI version from package.json next to dist/ (works when installed or from repo root).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type VersionInfo = {
  name: string;
  version: string;
  node: string;
  /** Set via WINSPECT_CLI_GIT_REF for local multi-branch builds */
  gitRef?: string;
};

function packageJsonPath(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  // dist/lib/version.js -> ../../package.json
  return join(dir, "..", "..", "package.json");
}

export function readPackageVersion(): { name: string; version: string } {
  const raw = readFileSync(packageJsonPath(), "utf8");
  const pkg = JSON.parse(raw) as { name?: string; version?: string };
  return {
    name: pkg.name ?? "@winspect/cli",
    version: pkg.version ?? "0.0.0",
  };
}

export function getCliVersion(): string {
  return readPackageVersion().version;
}

export function getVersionInfo(): VersionInfo {
  const { name, version } = readPackageVersion();
  const gitRef = process.env.WINSPECT_CLI_GIT_REF?.trim() || undefined;
  return {
    name,
    version,
    node: process.version,
    ...(gitRef ? { gitRef } : {}),
  };
}
