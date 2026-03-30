import { readFileSync, existsSync } from "fs";
import { join } from "path";
import YAML from "yaml";
export interface Spec0Yaml {
  spec?: string;
  name?: string;
  owner?: string;
  namespace?: string;
  strict?: boolean;
  checkBreaking?: boolean;
  "auto-create-team"?: boolean;
  "check-breaking"?: boolean;
}
const CONFIG_FILENAME = ".spec0.yaml";
export function loadSpec0Yaml(cwd: string): Spec0Yaml | null {
  const path = join(cwd, CONFIG_FILENAME);
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8");
  const doc = YAML.parse(content);
  if (!doc || typeof doc !== "object") return null;
  return doc as Spec0Yaml;
}
export function checkBreakingFromYaml(y: Spec0Yaml | null): boolean {
  if (!y) return false;
  if (typeof y.checkBreaking === "boolean") return y.checkBreaking;
  if (typeof y["check-breaking"] === "boolean") return y["check-breaking"];
  return false;
}
export function strictFromYaml(y: Spec0Yaml | null): boolean {
  if (!y) return false;
  return !!y.strict;
}
