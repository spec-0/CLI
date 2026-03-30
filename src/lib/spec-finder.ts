/**
 * Find openapi.yaml / openapi.json in current repo
 */

import { existsSync, readdirSync } from "fs";
import { join } from "path";

const DEFAULT_SPEC_NAMES = [
  "openapi.yaml",
  "openapi.yml",
  "openapi.json",
  "swagger.yaml",
  "swagger.json",
  "api-spec.yaml",
  "api-spec.json",
];

export function findSpecInDir(cwd: string = process.cwd()): string | null {
  for (const name of DEFAULT_SPEC_NAMES) {
    const p = join(cwd, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export function findSpecsInMonorepo(cwd: string): string[] {
  const found: string[] = [];
  // Simple scan: look for .spec0.yaml in subdirs, then resolve spec from each
  // For v1, just scan one level
  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) {
        const subSpec = findSpecInDir(join(cwd, e.name));
        if (subSpec) found.push(subSpec);
      }
    }
  } catch {
    // ignore
  }
  return found;
}
