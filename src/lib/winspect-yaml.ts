import { readFileSync, existsSync } from "fs";
import { join } from "path";
import YAML from "yaml";

export interface WinspectYaml {
  spec?: string;
  name?: string;
  owner?: string;
  namespace?: string;
  strict?: boolean;
  checkBreaking?: boolean;
  "auto-create-team"?: boolean;
  "check-breaking"?: boolean;
}

export function loadWinspectYaml(cwd: string): WinspectYaml | null {
  const path = join(cwd, ".winspect.yaml");
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8");
  const doc = YAML.parse(content);
  if (!doc || typeof doc !== "object") return null;
  return doc as WinspectYaml;
}

export function checkBreakingFromYaml(y: WinspectYaml | null): boolean {
  if (!y) return false;
  if (typeof y.checkBreaking === "boolean") return y.checkBreaking;
  if (typeof y["check-breaking"] === "boolean") return y["check-breaking"];
  return false;
}

export function strictFromYaml(y: WinspectYaml | null): boolean {
  if (!y) return false;
  return !!y.strict;
}
