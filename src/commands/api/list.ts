/**
 * spec0 api list — catalogue view of APIs in the org.
 *
 * Backed by GET /apis/summary?organisation-id=<orgId>. Includes counts
 * (operations, environments, subscribers) so a single round trip is
 * enough for a useful overview.
 */

import { Command } from "commander";
import { createOrgApiClient, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode } from "../../lib/exit-codes.js";
import { emit, fail, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";
import { renderTable } from "../../lib/output/table.js";

interface ApiListItem {
  apiId?: string;
  apiName?: string;
  version?: string;
  description?: string;
  status?: string;
  teamId?: string;
  teamName?: string;
  specSourceType?: string;
  operationCount?: number;
  environmentCount?: number;
  subscriberCount?: number;
  updatedAt?: string;
}

interface ApiSummaryListResponse {
  apis?: ApiListItem[];
}

export function registerApiListCommand(api: Command) {
  api
    .command("list")
    .description("List APIs in your organisation (catalogue view).")
    .option("--team <team>", "Filter by team name (case-insensitive)")
    .option("--status <status>", "Filter by status (e.g. ACTIVE, DEPRECATED)")
    .option("--search <query>", "Filter by name substring (case-insensitive)")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(
      async (
        opts: OutputOptions & {
          team?: string;
          status?: string;
          search?: string;
          org?: string;
        },
      ) => {
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
          const params = new URLSearchParams({ "organisation-id": authCtx.orgId });
          const res = (await client.getJson(
            `/apis/summary?${params.toString()}`,
          )) as ApiSummaryListResponse;

          const filtered = filterApis(res.apis ?? [], opts);
          emit(outCtx, filtered, renderApiListText);
        } catch (err) {
          if (is401(err)) {
            fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
              hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
            });
          }
          fail(outCtx, ExitCode.GENERIC, `api list failed: ${(err as Error).message}`);
        }
      },
    );
}

function filterApis(
  rows: ApiListItem[],
  opts: { team?: string; status?: string; search?: string },
): ApiListItem[] {
  let out = rows;
  if (opts.team) {
    const t = opts.team.toLowerCase();
    out = out.filter((r) => (r.teamName ?? "").toLowerCase() === t);
  }
  if (opts.status) {
    const s = opts.status.toUpperCase();
    out = out.filter((r) => (r.status ?? "").toUpperCase() === s);
  }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    out = out.filter((r) => (r.apiName ?? "").toLowerCase().includes(q));
  }
  return out;
}

function renderApiListText(rows: ApiListItem[]): string {
  if (!rows.length) return "No APIs found. Use `spec0 push` to add one.";
  return renderTable(rows as unknown as Record<string, unknown>[], [
    { key: "apiName", header: "Name" },
    { key: "version", header: "Ver" },
    { key: "status", header: "Status" },
    { key: "teamName", header: "Team" },
    { key: "operationCount", header: "Ops" },
    { key: "environmentCount", header: "Envs" },
    { key: "subscriberCount", header: "Subs" },
  ]);
}
