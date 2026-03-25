/**
 * Spectral runner for OpenAPI linting
 */

import { readFileSync } from "fs";
import spectralCore from "@stoplight/spectral-core";
const { Spectral } = spectralCore;
import { oas } from "@stoplight/spectral-rulesets";

export interface LintResult {
  score: number;
  errors: Array<{ line?: number; message: string; rule: string }>;
  warnings: Array<{ line?: number; message: string; rule: string }>;
}

export async function runSpectral(specPath: string, rulesetPath?: string): Promise<LintResult> {
  const spectral = new Spectral();
  if (rulesetPath) {
    try {
      // Spectral 6+: load custom ruleset file (YAML/JSON)
      await (spectral as unknown as { loadRuleset: (p: string) => Promise<void> }).loadRuleset(
        rulesetPath
      );
    } catch {
      spectral.setRuleset(oas as Parameters<typeof spectral.setRuleset>[0]);
    }
  } else {
    spectral.setRuleset(oas as Parameters<typeof spectral.setRuleset>[0]);
  }

  const specContent = readFileSync(specPath, "utf-8");
  const results = await spectral.run(specContent);

  const errors: LintResult["errors"] = [];
  const warnings: LintResult["warnings"] = [];

  for (const r of results) {
    const item = {
      line: r.range?.start?.line,
      message: r.message,
      rule: String(r.code ?? "unknown"),
    };
    if (r.severity === 0) errors.push(item);
    else warnings.push(item);
  }

  const total = errors.length + warnings.length;
  const score = total === 0 ? 100 : Math.max(0, 100 - errors.length * 10 - warnings.length * 2);

  return { score, errors, warnings };
}
