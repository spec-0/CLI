/**
 * spec0 lint — Spectral bundled, org ruleset fetch, JSON/text/github output
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { findSpecInDir } from "../lib/spec-finder.js";
import { resolveCliSpecPathFromFlags } from "../lib/cli-spec-path.js";
import { runSpectral } from "../lib/lint.js";
import { formatLintText, formatGitHubAnnotation } from "../lib/output.js";
import { createOrgApiClient } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import type { paths } from "../types.js";

type SpectralRulesetResponse =
  paths["/api-management/cli/v1/spectral-ruleset"]["get"]["responses"][200]["content"]["application/json"];

export function registerLintCommand(program: Command) {
  program
    .command("lint")
    .description("Lint OpenAPI spec with Spectral")
    .argument("[spec-file]", "Path to OpenAPI spec (or use --spec-file / global --spec-file)")
    .option("--spec-file <path>", "Path to OpenAPI spec file")
    .option("--ruleset <file>", "Use custom ruleset file")
    .option("--org-ruleset", "Fetch org ruleset from server")
    .option("--format <fmt>", "Output: text, json, github, sarif", "text")
    .option("--min-score <n>", "Exit 1 if score below n (0-100)", "0")
    .option("--strict", "Exit 1 on any warning")
    .action(async (specArg: string | undefined, opts: Record<string, string | boolean>, command: Command) => {
      const cwd = process.cwd();
      const specPath =
        resolveCliSpecPathFromFlags(
          command,
          cwd,
          opts.specFile as string | undefined,
          specArg
        ) ?? findSpecInDir(cwd);
      if (!specPath || !existsSync(specPath)) {
        console.error(chalk.red("Spec file not found."));
        process.exit(1);
      }

      let rulesetFile = opts.ruleset as string | undefined;
      if (opts.orgRuleset) {
        try {
          const ctx = requireOrgContext();
          const client = createOrgApiClient(ctx);
          const res = (await client.getJson(
            "/api-management/cli/v1/spectral-ruleset"
          )) as SpectralRulesetResponse;
          const yaml = res.rulesetYaml?.trim() ?? "";
          if (!yaml) {
            console.warn(
              chalk.yellow("No org ruleset stored on the server; using built-in OAS ruleset.")
            );
          } else {
            rulesetFile = join(tmpdir(), `spec0-org-ruleset-${Date.now()}.yaml`);
            writeFileSync(rulesetFile, yaml, "utf-8");
          }
        } catch (e) {
          console.error(chalk.red((e as Error).message));
          process.exit(1);
        }
      }

      const result = await runSpectral(specPath, rulesetFile);

      if (opts.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else if (opts.format === "github") {
        for (const e of result.errors) {
          console.log(formatGitHubAnnotation(specPath, e.line ?? 0, "error", e.message));
        }
        for (const w of result.warnings) {
          console.log(formatGitHubAnnotation(specPath, w.line ?? 0, "warning", w.message));
        }
      } else {
        console.log(`Linting ${specPath}... (oas ruleset)\n`);
        console.log(formatLintText(result));
      }

      const minScore = parseInt(String(opts.minScore ?? "0"), 10);
      if (result.score < minScore) process.exit(1);
      if (opts.strict === true && result.warnings.length > 0) process.exit(1);
      if (result.errors.length > 0) process.exit(1);
    });
}
