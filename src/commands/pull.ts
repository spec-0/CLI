/**
 * spec0 pull <org>/<name> — download spec from registry
 */

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "fs";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { parseRegistryRef } from "../lib/registry-ref.js";

export function registerPullCommand(program: Command) {
  program
    .command("pull <ref>")
    .description(
      "Download spec from registry (e.g. acme/order-service or acme/order-service@v1.2.0)",
    )
    .option("-o, --output <file>", "Write to file instead of stdout")
    .option("--public", "Reserved for public registry (same endpoint when API is public)")
    .option("--org <uuid>", "Auth org id (defaults to logged-in org)")
    .action(async (ref: string, opts: { output?: string; public?: boolean; org?: string }) => {
      let parsed;
      try {
        parsed = parseRegistryRef(ref);
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
      const path = parsed.tag
        ? `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}/versions/${encodeURIComponent(parsed.tag)}`
        : `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}?format=yaml`;

      try {
        const yaml = await client.getText(path);
        if (opts.output) {
          writeFileSync(opts.output, yaml, "utf-8");
          console.log(chalk.green(`Wrote ${opts.output}`));
        } else {
          process.stdout.write(yaml);
        }
      } catch (err) {
        if (is401(err)) {
          console.error(chalk.red("Token invalid. Run 'spec0 auth login'."));
          process.exit(1);
        }
        console.error(chalk.red(`Pull failed: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
