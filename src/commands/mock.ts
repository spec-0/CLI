/**
 * spec0 mock create | list | url | delete | regenerate-key | logs
 */

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import type { components, paths } from "../types.js";

type MockRow = components["schemas"]["MockItem"];
type CreateMockRequest =
  paths["/api-management/cli/v1/mocks"]["post"]["requestBody"]["content"]["application/json"];
type CreateMockResponse =
  paths["/api-management/cli/v1/mocks"]["post"]["responses"][200]["content"]["application/json"];

export function registerMockCommands(program: Command) {
  const mock = program.command("mock").description("Mock server management");

  mock
    .command("create")
    .description("Create mock server, print URL and key")
    .option("--api <name>", "API name (required unless --api-id is set)")
    .option("--api-id <uuid>", "API id")
    .option("--org <uuid>", "Org id override")
    .action(async (opts: { api?: string; apiId?: string; org?: string }) => {
      let ctx;
      try {
        ctx = requireOrgContext(opts.org);
      } catch (e) {
        console.error(chalk.red((e as Error).message));
        process.exit(1);
      }
      if (!opts.api && !opts.apiId) {
        console.error(chalk.red("Provide --api <name> or --api-id <uuid>"));
        process.exit(1);
      }
      const client = createOrgApiClient(ctx);
      const body: CreateMockRequest = {
        apiName: opts.api,
        apiId: opts.apiId,
      };
      try {
        const res = (await client.postJson(
          "/api-management/cli/v1/mocks",
          body,
        )) as CreateMockResponse;
        const base = ctx.apiUrl;
        const fullUrl = `${base}${res.mockBaseUrl ?? ""}`;
        console.log(chalk.green("Mock server:"));
        console.log(`  Mock URL:  ${fullUrl}`);
        if (res.apiKey) {
          console.log(`  API Key:   ${res.apiKey} (copy and keep safe — shown once)`);
        } else {
          console.log(chalk.yellow("  (Existing mock — API key was issued at creation.)"));
        }
      } catch (err) {
        if (is401(err)) {
          console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
          process.exit(1);
        }
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  mock
    .command("list")
    .description("List all mock servers")
    .option("--org <uuid>", "Org id override")
    .action(async (opts: { org?: string }) => {
      let ctx;
      try {
        ctx = requireOrgContext(opts.org);
      } catch (e) {
        console.error(chalk.red((e as Error).message));
        process.exit(1);
      }
      const client = createOrgApiClient(ctx);
      try {
        const rows = (await client.getJson("/api-management/cli/v1/mocks")) as MockRow[];
        const table = new Table({
          head: ["API", "Name", "Mock URL"],
        });
        for (const m of rows) {
          const label = m.apiName ?? m.apiId ?? "-";
          table.push([label, m.name ?? "-", `${ctx.apiUrl}${m.mockBaseUrl ?? ""}`]);
        }
        console.log(table.toString());
      } catch (err) {
        if (is401(err)) {
          console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
          process.exit(1);
        }
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  mock
    .command("url <api-name>")
    .description("Print mock base URL for API")
    .option("--org <uuid>", "Org id override")
    .action(async (apiName: string, opts: { org?: string }) => {
      let ctx;
      try {
        ctx = requireOrgContext(opts.org);
      } catch (e) {
        console.error(chalk.red((e as Error).message));
        process.exit(1);
      }
      const client = createOrgApiClient(ctx);
      const rows = (await client.getJson("/api-management/cli/v1/mocks")) as MockRow[];
      const hit = rows.find((r) => (r.apiName ?? "").toLowerCase() === apiName.toLowerCase());
      if (!hit) {
        console.error(chalk.red(`No mock found for API name '${apiName}'.`));
        process.exit(1);
      }
      console.log(`${ctx.apiUrl}${hit.mockBaseUrl ?? ""}`);
    });
}
