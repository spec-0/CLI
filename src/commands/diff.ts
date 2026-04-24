/**
 * spec0 diff — compare two OpenAPI specs (registry refs and/or local files)
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { createTwoFilesPatch } from "diff";
import { createOrgApiClient, is401, extractErrorMessage } from "../lib/api-client.js";
import { requireOrgContext, type ResolvedOrgContext } from "../lib/auth-context.js";
import { parseRegistryRef } from "../lib/registry-ref.js";

interface SpecDiffResponse {
  hasBreakingChanges: boolean;
  changelog?: Record<string, unknown>;
  breakingChanges?: Record<string, unknown>[];
}

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

async function breakingChangesViaBackend(
  ctx: ResolvedOrgContext,
  leftContent: string,
  rightContent: string,
  leftLabel: string,
  rightLabel: string,
): Promise<void> {
  const client = createOrgApiClient(ctx);
  const result = await client.postMultipart<SpecDiffResponse>("/api-management/cli/v1/diff", {
    base: { content: leftContent, filename: leftLabel },
    revision: { content: rightContent, filename: rightLabel },
  });

  if (!result.hasBreakingChanges) {
    console.log(chalk.green("No breaking changes detected."));
    return;
  }

  console.log(chalk.red(`Breaking changes detected:`));
  if (result.breakingChanges?.length) {
    for (const bc of result.breakingChanges) {
      const id = bc["id"] ?? bc["text"] ?? JSON.stringify(bc);
      const level = bc["level"] ?? "";
      const msg = bc["message"] ?? bc["text"] ?? "";
      console.log(chalk.red(`  [${level}] ${id}${msg ? ": " + msg : ""}`));
    }
  }
}

export function registerDiffCommand(program: Command) {
  program
    .command("diff")
    .description(
      "Diff two specs: each side is a file path or registry ref org/api[@tag] (latest if tag omitted)",
    )
    .argument("<a>", "Left: local path or org/api[@tag]")
    .argument("<b>", "Right: local path or org/api[@tag]")
    .option("--breaking-only", "Show breaking changes only (via backend oasdiff service)")
    .option("--org <uuid>", "Org id override for registry fetches")
    .action(async (a: string, b: string, opts: { breakingOnly?: boolean; org?: string }) => {
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
        try {
          await breakingChangesViaBackend(ctx, left, right, a, b);
        } catch (err) {
          if (is401(err)) {
            console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
            process.exit(1);
          }
          const msg = extractErrorMessage(err) ?? (err as Error).message;
          console.error(chalk.red(`Breaking change check failed: ${msg}`));
          process.exit(1);
        }
        return;
      }

      const patch = createTwoFilesPatch(a, b, left, right, "", "", { context: 3 });
      if (!patch.trim()) {
        console.log(chalk.green("No textual differences."));
        return;
      }
      process.stdout.write(patch);
    });
}
