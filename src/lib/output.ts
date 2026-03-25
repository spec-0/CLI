/**
 * Formatters: text, json, github (GH Actions annotations)
 */

import chalk from "chalk";

export type OutputFormat = "text" | "json" | "github";

export function formatLintText(result: {
  score: number;
  errors: Array<{ line?: number; message: string; rule: string }>;
  warnings: Array<{ line?: number; message: string; rule: string }>;
}): string {
  const lines: string[] = [];
  lines.push(`  Score: ${result.score}/100`);
  lines.push("");
  lines.push(`  Errors (${result.errors.length}):`);
  for (const e of result.errors) {
    lines.push(`    line ${e.line ?? "?"}  ${e.rule}  ${e.message}`);
  }
  if (result.errors.length === 0) lines.push("    (none)");
  lines.push("");
  lines.push(`  Warnings (${result.warnings.length}):`);
  for (const w of result.warnings) {
    lines.push(`    line ${w.line ?? "?"}  ${w.rule}  ${w.message}`);
  }
  if (result.warnings.length === 0) lines.push("    (none)");
  lines.push("");
  if (result.errors.length === 0) {
    lines.push(chalk.green("  ✓ 0 errors. Spec is publishable."));
  } else {
    lines.push(chalk.red(`  ✗ ${result.errors.length} errors. Fix before publishing.`));
  }
  return lines.join("\n");
}

export function formatPublishText(output: {
  apiId: string;
  version: string;
  specUrl: string;
  mockUrl?: string;
}): string {
  const lines: string[] = [];
  lines.push("Published!");
  lines.push(`  API ID:     ${output.apiId}`);
  lines.push(`  Version:    ${output.version} (latest)`);
  lines.push(`  Spec Page:  ${output.specUrl}`);
  if (output.mockUrl) lines.push(`  Mock URL:   ${output.mockUrl}`);
  return lines.join("\n");
}

export function formatGitHubAnnotation(
  file: string,
  line: number,
  level: "error" | "warning",
  message: string
): string {
  return `::${level} file=${file},line=${line}::${message.replace(/\n/g, "%0A")}`;
}
