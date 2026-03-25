/**
 * Parse .github/CODEOWNERS for team ownership
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Extract team from CODEOWNERS line like:
 * /path/to/spec.yaml @myorg/backend-team
 * Returns "backend-team" or null
 */
export function parseCodeownersLine(line: string, specPath: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;
  const pattern = parts[0];
  const owner = parts[1];
  // Simple match: if pattern matches spec path
  if (!specPath.includes(pattern.replace(/^\//, ""))) return null;
  // @org/team-name -> team-name
  if (owner.startsWith("@") && owner.includes("/")) {
    return owner.split("/").pop() ?? null;
  }
  return owner.startsWith("@") ? owner.slice(1) : owner;
}

export function getTeamFromCodeowners(cwd: string, specPath: string): string | null {
  const codeownersPath = join(cwd, ".github", "CODEOWNERS");
  if (!existsSync(codeownersPath)) return null;
  const content = readFileSync(codeownersPath, "utf-8");
  const lines = content.split("\n");
  let lastMatch: string | null = null;
  for (const line of lines) {
    const team = parseCodeownersLine(line, specPath);
    if (team) lastMatch = team;
  }
  return lastMatch;
}
