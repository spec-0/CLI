/**
 * spec0 mock list — one row per mock server in the org.
 *
 * Already modernised in a prior PR; moved here as part of the mock.ts split.
 */

import { Command } from "commander";
import { createOrgApiClient, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode } from "../../lib/exit-codes.js";
import { emit, fail, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";
import { renderTable } from "../../lib/output/table.js";
import type { MockItem } from "./create.js";

export function registerMockListCommand(mock: Command) {
  mock
    .command("list")
    .description("List all mock servers in the org.")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (opts: OutputOptions & { org?: string }) => {
      const outCtx = resolveOutputContext(opts);

      let authCtx;
      try {
        authCtx = requireOrgContext(opts.org);
      } catch (e) {
        fail(outCtx, ExitCode.AUTH_MISSING, (e as Error).message, {
          hint: "Set SPEC0_TOKEN + SPEC0_ORG_ID, or run 'spec0 auth login'.",
        });
      }

      const client = createOrgApiClient(authCtx);
      try {
        const rows = (await client.getJson("/api-management/cli/v1/mocks")) as MockItem[];
        const enriched = rows.map((m) => ({
          api: m.apiName ?? m.apiId ?? "—",
          name: m.name ?? "—",
          mockUrl: `${authCtx.apiUrl}${m.mockBaseUrl ?? ""}`,
        }));
        emit(outCtx, enriched, (data) =>
          renderTable(data as unknown as Record<string, unknown>[], [
            { key: "api", header: "API" },
            { key: "name", header: "Name" },
            { key: "mockUrl", header: "Mock URL" },
          ]),
        );
      } catch (err) {
        if (is401(err)) {
          fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
            hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
          });
        }
        fail(outCtx, ExitCode.GENERIC, `mock list failed: ${(err as Error).message}`);
      }
    });
}
