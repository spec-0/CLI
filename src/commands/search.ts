/**
 * spec0 search — semantic search via RAG (proxied by platform)
 */

import { Command } from "commander";
import chalk from "chalk";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";

export function registerSearchCommand(program: Command) {
  program
    .command("search <query>")
    .description("Semantic search for APIs in your org")
    .option("--org <uuid>", "Org id override")
    .option("--public", "Reserved — public registry search uses same backend when enabled")
    .option("--max-results <n>", "Max results", "10")
    .action(
      async (query: string, opts: { org?: string; public?: boolean; maxResults?: string }) => {
        let ctx;
        try {
          ctx = requireOrgContext(opts.org);
        } catch (e) {
          console.error(chalk.red((e as Error).message));
          process.exit(1);
        }
        const client = createOrgApiClient(ctx);
        try {
          const res = (await client.postJson("/registry/search", {
            query,
            maxResults: parseInt(opts.maxResults ?? "10", 10),
          })) as {
            results?: Array<{
              apiName?: string;
              apiId?: string;
              matchedContent?: string;
              teamName?: string;
              version?: string;
            }>;
          };

          const list = res.results ?? [];
          if (list.length === 0) {
            console.log(chalk.yellow("No results."));
            return;
          }
          console.log(chalk.blue(`Results for "${query}":\n`));
          let i = 1;
          for (const r of list) {
            const id = r.apiId != null ? String(r.apiId) : "";
            const title = r.apiName || id || "API";
            const meta = [r.version, r.teamName].filter(Boolean).join(" · ");
            const body = r.matchedContent ?? "";
            console.log(`  ${i++}. ${title}  ${meta ? `(${meta})` : ""}`);
            if (body)
              console.log(chalk.gray(`     ${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`));
          }
        } catch (err) {
          if (is401(err)) {
            console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
            process.exit(1);
          }
          console.error(chalk.red(`Search failed: ${(err as Error).message}`));
          process.exit(1);
        }
      },
    );
}
