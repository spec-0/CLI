/**
 * spec0 diff — compare two OpenAPI specs (registry refs and/or local files)
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createTwoFilesPatch } from "diff";
import { execFileSync } from "child_process";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext, type ResolvedOrgContext } from "../lib/auth-context.js";
import { parseRegistryRef } from "../lib/registry-ref.js";

async function loadSpecContent(token: string, ctx: ResolvedOrgContext): Promise<string> {
  const trimmed = token.trim();
  if (existsSync(trimmed)) {
    return readFileSync(trimmed, "utf-8");
  }
  const client = createOrgApiClient(ctx);
  const parsed = parseRegistryRef(trimmed);
  const path = parsed.tag
    ? `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}/versions/${encodeURIComponent(parsed.tag)}`
    : `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}?format=yaml`;
  return client.getText(path);
}

function tryOasdiffBreaking(oldSpec: string, newSpec: string): string | null {
  try {
    const dir = mkdtempSync(join(tmpdir(), "spec0-diff-"));
    const a = join(dir, "a.yaml");
    const b = join(dir, "b.yaml");
    writeFileSync(a, oldSpec, "utf-8");
    writeFileSync(b, newSpec, "utf-8");
    const out = execFileSync("oasdiff", ["breaking", a, b], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return out;
  } catch {
    return null;
  }
}

export function registerDiffCommand(program: Command) {
  program
    .command("diff")
    .description(
      "Diff two specs: each side is a file path or registry ref org/api[@tag] (latest if tag omitted)"
    )
    .argument("<a>", "Left: local path or org/api[@tag]")
    .argument("<b>", "Right: local path or org/api[@tag]")
    .option("--breaking-only", "Use oasdiff CLI for breaking changes only (install: oasdiff)")
    .option("--org <uuid>", "Org id override for registry fetches")
    .action(
      async (
        a: string,
        b: string,
        opts: { breakingOnly?: boolean; org?: string }
      ) => {
        let ctx;
        try {
          ctx = requireOrgContext(opts.org);
        } catch (e) {
          console.error(chalk.red((e as Error).message));
          process.exit(1);
        }

        let left: string;
        let right: string;
        try {
          left = await loadSpecContent(a, ctx);
          right = await loadSpecContent(b, ctx);
        } catch (err) {
          if (is401(err)) {
            console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
            process.exit(1);
          }
          console.error(chalk.red(`Failed to load spec: ${(err as Error).message}`));
          process.exit(1);
        }

        if (opts.breakingOnly) {
          const report = tryOasdiffBreaking(left, right);
          if (report === null) {
            console.error(
              chalk.red(
                "oasdiff not available. Install: https://github.com/Tufin/oasdiff — or omit --breaking-only for a line diff."
              )
            );
            process.exit(2);
          }
          console.log(report || chalk.green("No breaking changes (oasdiff)."));
          return;
        }

        const patch = createTwoFilesPatch(a, b, left, right, "", "", { context: 3 });
        if (!patch.trim()) {
          console.log(chalk.green("No textual differences."));
          return;
        }
        process.stdout.write(patch);
      }
    );
}
