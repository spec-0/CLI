/**
 * spec0 log — version history from registry
 */

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { getDefaultOrgId, getOrgConfig } from "../lib/config.js";
import { parseRegistryRef } from "../lib/registry-ref.js";

interface VersionRow {
  tag?: string;
  gitSha?: string;
  publishedAt?: string;
  breakingChangesRecorded?: boolean;
  breakingChangeSummary?: string;
}

export function registerLogCommand(program: Command) {
  program
    .command("log <api-ref>")
    .description(
      "Show published version history. api-ref: api-name (default org) or org-slug/api-name"
    )
    .option("--org <uuid>", "Org id override (auth)")
    .option(
      "--org-slug <slug>",
      "Organisation slug/name for registry path when api-ref has no slash (default: name from spec0 auth config)"
    )
    .option("--json", "Print JSON array")
    .action(
      async (
        apiRef: string,
        opts: { org?: string; orgSlug?: string; json?: boolean }
      ) => {
        let orgSlug: string;
        let apiName: string;
        try {
          if (apiRef.includes("/")) {
            const p = parseRegistryRef(apiRef);
            orgSlug = p.org;
            apiName = p.api;
          } else {
            const orgId = process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
            const cfg = orgId ? getOrgConfig(orgId) : undefined;
            const fallback = cfg?.name?.trim();
            orgSlug = (opts.orgSlug ?? fallback ?? "").trim();
            if (!orgSlug) {
              console.error(
                chalk.red(
                  "Set --org-slug <slug> or use org-slug/api-name, or run spec0 auth login."
                )
              );
              process.exit(1);
            }
            apiName = apiRef.trim();
          }
        } catch (e) {
          console.error(chalk.red((e as Error).message));
          process.exit(1);
        }

        let ctx;
        try {
          ctx = requireOrgContext(opts.org);
        } catch (e) {
          console.error(chalk.red((e as Error).message));
          process.exit(1);
        }

        const client = createOrgApiClient(ctx);
        const path = `/registry/${encodeURIComponent(orgSlug)}/${encodeURIComponent(apiName)}/versions`;

        try {
          const rows = (await client.getJson(path)) as VersionRow[];
          if (opts.json) {
            console.log(JSON.stringify(rows, null, 2));
            return;
          }
          if (!rows.length) {
            console.log(chalk.yellow("No published versions found."));
            return;
          }
          const table = new Table({
            head: ["Tag", "Published", "Git SHA", "Breaking data"],
            style: { head: ["cyan"] },
          });
          for (const r of rows) {
            const br = r.breakingChangesRecorded ? "yes" : "—";
            table.push([
              r.tag ?? "—",
              r.publishedAt ?? "—",
              (r.gitSha ?? "—").slice(0, 12),
              br,
            ]);
          }
          console.log(chalk.blue(`${orgSlug}/${apiName} version history:\n`));
          console.log(table.toString());
          for (const r of rows) {
            if (r.breakingChangeSummary) {
              const prev = (r.breakingChangeSummary ?? "").slice(0, 500);
              console.log(chalk.gray(`\n${r.tag}: ${prev}${prev.length >= 500 ? "…" : ""}`));
            }
          }
        } catch (err) {
          if (is401(err)) {
            console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
            process.exit(1);
          }
          console.error(chalk.red(`Log failed: ${(err as Error).message}`));
          process.exit(1);
        }
      }
    );
}
