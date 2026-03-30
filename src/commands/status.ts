/**
 * spec0 status — org overview (APIs, mocks, teams, plan)
 */

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { getDefaultOrgId, getOrgConfig } from "../lib/config.js";
import type { components } from "../types.js";

type MockRow = components["schemas"]["MockItem"];

interface OrgSummary {
  apiCount?: number;
  mockServerCount?: number;
  teamCount?: number;
  plan?: string;
}

export function registerStatusCommand(program: Command) {
  program
    .command("status")
    .description("Show org overview: API count, mock servers, teams, plan")
    .option("--org <uuid>", "Org id override")
    .option("--json", "Print JSON")
    .action(async (opts: { org?: string; json?: boolean }) => {
      const orgId = process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
      if (!orgId || !getOrgConfig(orgId)) {
        console.log(chalk.yellow("Not logged in. Run 'spec0 auth login'."));
        return;
      }
      const org = getOrgConfig(orgId)!;

      let ctx;
      try {
        ctx = requireOrgContext(opts.org);
      } catch (e) {
        console.error(chalk.red((e as Error).message));
        process.exit(1);
      }

      const client = createOrgApiClient(ctx);
      try {
        const summary = (await client.getJson(
          "/api-management/cli/v1/org-summary"
        )) as OrgSummary;
        const mocks = (await client.getJson("/api-management/cli/v1/mocks")) as MockRow[];

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                orgName: org.name,
                apiUrl: org.apiUrl,
                ...summary,
                mocks,
              },
              null,
              2
            )
          );
          return;
        }

        console.log(chalk.bold(`Org: ${org.name}`));
        console.log(`API URL: ${org.apiUrl}`);
        if (org.keyName) console.log(`Key: ${org.keyName}`);
        console.log("");
        console.log(
          `  APIs:         ${summary.apiCount ?? "—"}\n` +
            `  Mock servers: ${summary.mockServerCount ?? mocks.length}\n` +
            `  Teams:        ${summary.teamCount ?? "—"}\n` +
            `  Plan:         ${summary.plan ?? "—"}`
        );

        if (mocks.length > 0) {
          console.log(chalk.blue("\nMock servers:\n"));
          const table = new Table({
            head: ["API", "Mock name", "Base path"],
            style: { head: ["cyan"] },
          });
          for (const m of mocks) {
            table.push([
              m.apiName ?? m.apiId ?? "—",
              m.name ?? "—",
              m.mockBaseUrl ?? "—",
            ]);
          }
          console.log(table.toString());
        }
      } catch (err) {
        if (is401(err)) {
          console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
          process.exit(1);
        }
        console.error(chalk.red(`Status failed: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
